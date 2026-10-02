import { Module } from "@nestjs/common";
import { PreferencesController } from "@/preferences/preferences.controller.js";
import { PreferencesService } from "@/preferences/preferences.service.js";
@Module({ controllers: [PreferencesController], providers: [PreferencesService], exports: [PreferencesService] })
export class PreferencesModule {}
