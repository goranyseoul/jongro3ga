import Link from "next/link";
import { buttonStyles } from "./button";
import { Card, CardHeader } from "./card";

export type SignedOutCardProps = {
  title?: string;
  description: string;
  /** Login page with ?next= back to this screen. */
  loginHref: string;
};

// What a signed-in-only console screen shows instead of redirecting during render.
export function SignedOutCard({ title = "로그인이 필요해요", description, loginHref }: SignedOutCardProps) {
  return (
    <Card className="flex max-w-xl flex-col gap-sp-4">
      <CardHeader as="h2" title={title} description={description} />
      <div>
        <Link href={loginHref} className={buttonStyles({ variant: "primary" })}>
          로그인하러 가기
        </Link>
      </div>
    </Card>
  );
}
