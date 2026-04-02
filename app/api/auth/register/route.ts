import { NextResponse } from "next/server";

export async function POST(req: Request) {
  void req;
  return NextResponse.json(
    { error: "registration_disabled", message: "已关闭普通用户注册，请联系管理员创建账号。" },
    { status: 403 },
  );
}
