import { redirect } from "next/navigation";

// `/my-page` is a legacy entry point kept because it's the post-auth landing
// target (the login form, the auth callback and the password-reset flow all
// default here) and is linked from the 404 page. The editor lives at /edit,
// which handles the signed-out and no-username cases itself — so this is a
// plain hop rather than a second copy of those checks.
export default function MyPage() {
  redirect("/edit");
}
