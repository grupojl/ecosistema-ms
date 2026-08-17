import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
/** @Public() — marca una ruta como pública. El guard global la deja pasar. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
