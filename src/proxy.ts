import { NextResponse, type NextRequest } from "next/server";

import { isPublicPath, LOGIN_PATH } from "@/lib/auth/paths";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, isAuthenticated } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // Checagem otimista: perfil ativo e escopo são verificados no DAL e no RLS.
  if (!isAuthenticated && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = "";
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
