import { NextRequest, NextResponse } from "next/server";
import { ROUTE } from "./app/constant/route";
import { auth } from "./lib/auth";

const excludedPaths = [
  ROUTE.HOME,
  ROUTE.LOGIN,
  ROUTE.FINISH_REGISTRATION,
  ROUTE.FORGOT_PASSWORD,
  ROUTE.NEW_PASSWORD,
  ROUTE.CGU,
  ROUTE.HELP,
  ROUTE.CONTACT,
  ROUTE.VERIFY_2FA,
  ROUTE.SETUP_2FA,
  ROUTE.STATISTIQUES,
  ROUTE.ACCESSIBILITE,
  ROUTE.PLAN_DU_SITE,
  ROUTE.MENTIONS_LEGALES,
  ROUTE.DONNEES_PERSONNELLES,
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip authentication check for public pages
  if (excludedPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Validate session server-side (signature, expiration, revocation)
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    // Conserver la destination initiale pour rediriger l'utilisateur après
    // connexion (ex: lien d'email vers un signalement précis).
    const loginUrl = new URL(ROUTE.LOGIN, request.url);
    loginUrl.searchParams.set("returnTo", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Enforce 2FA for admins server-side
  if (
    session.user.role === "admin" &&
    !session.user.twoFactorEnabled &&
    pathname !== ROUTE.SETUP_2FA
  ) {
    return NextResponse.redirect(new URL(ROUTE.SETUP_2FA, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|assets|artwork|\\.well-known).*)",
    "/signalement/:path*",
  ],
};
