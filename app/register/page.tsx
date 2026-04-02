import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-4 text-xl font-semibold">注册已关闭</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        普通用户不能自助注册，请联系管理员在后台创建用户名和密码。
      </p>
      <Link href="/login" className="mt-5 inline-block text-sm underline">
        返回登录
      </Link>
    </main>
  );
}
