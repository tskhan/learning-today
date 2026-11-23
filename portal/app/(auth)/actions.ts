"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanText, LIMITS } from "@/lib/limits";
import { field, safeNext, type FormState } from "@/lib/forms";
import { ipFromHeaders, JOIN_CODE_LIMIT, recordWrongCode, tooManyWrongCodes } from "@/lib/signup-throttle";
import { loginErrorMessage, REMOVED_MESSAGE as REMOVED, unavailableMessage } from "@/lib/errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUp(_prev: FormState, fd: FormData): Promise<FormState> {
  const fullName = cleanText(field(fd, "full_name"), LIMITS.name);
  const email = field(fd, "email").trim().toLowerCase();
  const password = field(fd, "password");
  const joinCode = field(fd, "join_code").trim();
  if (!fullName) return { error: `Enter your full name (up to ${LIMITS.name} characters).` };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Choose a password of at least 8 characters." };

  const admin = createAdminClient();
  const { data: settings, error: settingsError } = await admin.from("settings").select("join_code").single();
  if (settingsError || !settings) {
    // Is the secret key itself accepted? (A wrong key and missing grants both look like "permission denied".)
    const { error: keyError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    console.error("signUp: could not read the join code from settings", { settingsError, keyError });
    const keyRejected = keyError?.status === 401 || keyError?.status === 403;
    return { error: unavailableMessage(settingsError, !keyRejected) };
  }
  const ip = ipFromHeaders(await headers());
  if (await tooManyWrongCodes(admin, ip)) {
    return { error: `Too many wrong join codes from your network. Wait ${JOIN_CODE_LIMIT.minutes} minutes, then try again.` };
  }
  if (joinCode.toLowerCase() !== settings.join_code.trim().toLowerCase()) {
    await recordWrongCode(admin, ip);
    return { error: "That join code isn't right. Ask in the Batch 91 WhatsApp group for the current code." };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError) {
    if (createError.code === "email_exists" || /already/i.test(createError.message)) {
      return { error: "There's already an account with that email. Log in instead, or reset your password." };
    }
    if (createError.code === "weak_password") return { error: "Choose a stronger password." };
    console.error("signUp: createUser failed", createError);
    return { error: "We couldn't create your account. Please try again." };
  }

  // The database starts every new account as removed; only this form, after checking the join code, activates it.
  const { error: activateError } = await admin.from("profiles").update({ status: "active" }).eq("id", created.user.id);
  if (activateError) {
    console.error("signUp: could not activate the new account", activateError);
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "We couldn't create your account. Please try again." };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) redirect("/login");
  redirect("/");
}

export async function logIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = field(fd, "email").trim().toLowerCase();
  const password = field(fd, "password");
  const next = safeNext(fd.get("next"));
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: loginErrorMessage(error) };
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    return { error: REMOVED };
  }
  redirect(next);
}

export async function logOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = field(fd, "email").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
  });
  return { ok: "If that email has an account, a reset link is on its way. Check your inbox and spam folder." };
}

export async function setNewPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const password = field(fd, "password");
  const confirm = field(fd, "confirm");
  if (password.length < 8) return { error: "Choose a password of at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "Your reset link has expired. Request a new one from the login page." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password different from your old one." };
    return { error: "We couldn't save your new password. Please try again." };
  }
  redirect("/?reset=1");
}
