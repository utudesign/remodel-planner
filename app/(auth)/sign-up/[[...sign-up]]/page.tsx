import { SignUp } from "@clerk/nextjs";

export const metadata = { title: "Sign up" };

export default function Page() {
  return <SignUp />;
}
