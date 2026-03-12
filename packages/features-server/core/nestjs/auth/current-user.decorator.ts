import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { JwtUser } from "./jwt-parser";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
