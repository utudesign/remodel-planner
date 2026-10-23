import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Sign in" };

export default function Page() {
  return <SignIn />;
}
