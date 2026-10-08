import { Module } from "@nestjs/common";
import { NotificationsModule } from "@/core/notifications/notifications.module.js";
import { PreferencesModule } from "@/core/preferences/preferences.module.js";
import { NotificacionesGrpcController } from "@/grpc/notificaciones-grpc.controller.js";
@Module({ imports: [NotificationsModule, PreferencesModule], controllers: [NotificacionesGrpcController] })
export class GrpcModule {}
