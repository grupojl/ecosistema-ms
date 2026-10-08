import { Module } from "@nestjs/common";
import { PreferencesController } from "@/core/preferences/preferences.controller.js";
import { PreferencesService } from "@/core/preferences/preferences.service.js";
@Module({ controllers: [PreferencesController], providers: [PreferencesService], exports: [PreferencesService] })
export class PreferencesModule {}
