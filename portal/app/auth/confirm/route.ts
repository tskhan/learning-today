import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Opens a password-reset link: verifies the one-time token, then goes to the page for choosing a
 * new password. Only password-reset links are accepted (other kinds of Supabase link aren't used
 * by the portal, and accepting them would let someone sign a visitor into the wrong account), and
 * where it goes next is fixed, never taken from the link.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (tokenHash && type === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL("/reset-password", request.url));
  }
  return NextResponse.redirect(new URL("/forgot-password?expired=1", request.url));
}
