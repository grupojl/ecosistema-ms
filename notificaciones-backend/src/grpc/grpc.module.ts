import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { PreferencesModule } from "../preferences/preferences.module.js";
import { NotificacionesGrpcController } from "./notificaciones-grpc.controller.js";
@Module({ imports: [NotificationsModule, PreferencesModule], controllers: [NotificacionesGrpcController] })
export class GrpcModule {}
