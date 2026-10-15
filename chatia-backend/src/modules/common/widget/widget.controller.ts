// src/modules/common/widget/widget.controller.ts
//
// Widget público embebible. Cada mensaje cuesta una llamada a LLM, por eso:
//  - la sesión la emite el servidor (token firmado); el cliente NO elige el userId
//  - límites por IP, por sesión y cuota diaria por proyecto (RateLimitService)
//  - el historial solo se lee con el token de la propia sesión
//  - el slug no es único entre organizaciones: ?org= desambigua (el snippet lo incluye)
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  Req,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  HttpException,
  ForbiddenException,
} from '@nestjs/common';
import {
  WidgetChatSchema,
  type WidgetChatInput,
} from '@/core/widget/schemas.js';
import { ZodValidationPipe } from '@/infrastructure/common/pipes/zod-validation.pipe.js';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WidgetConfigService } from '@/core/widget/widget-config.service.js';
import { AssistantChatService } from '@/core/assistant/chat/assistant-chat.service.js';
import { AssistantSessionService } from '@/core/assistant/session/assistant-session.service.js';
import { RateLimitService } from '@/infrastructure/security/rate-limit.service.js';
import { WidgetSessionService } from '@/core/widget/widget-session.service.js';

const envInt = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Escapa un string para incrustarlo en JS dentro de un <script>/archivo .js sin romper ni inyectar. */
const BACKSLASH = String.fromCharCode(92);
const UNSAFE_IN_SCRIPT = new RegExp(
  `[<>${String.fromCharCode(0x2028, 0x2029)}]`,
  'g',
);

export function toJsString(value: string): string {
  return JSON.stringify(value).replace(
    UNSAFE_IN_SCRIPT,
    (ch) => `${BACKSLASH}u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

@ApiTags('Widget (público)')
@Controller('api/v1/widget')
export class WidgetController {
  constructor(
    private readonly widgetConfig: WidgetConfigService,
    private readonly chatService: AssistantChatService,
    private readonly sessionService: AssistantSessionService,
    private readonly rateLimit: RateLimitService,
    private readonly widgetSessions: WidgetSessionService,
  ) {}

  // ── Config pública del asistente ─────────────────────────────────────────
  @Get(':projectSlug/config')
  @ApiOperation({ summary: 'Config pública del asistente (sin auth)' })
  async getConfig(
    @Param('projectSlug') slug: string,
    @Query('org') org?: string,
  ) {
    const config = await this.resolveConfig(slug, org);
    // Solo campos públicos — nunca systemPrompt ni el modelo
    return {
      personaName: config.personaName,
      welcomeMessage: config.welcomeMessage,
      isEnabled: config.isEnabled,
    };
  }

  // ── Emitir sesión (token firmado) ─────────────────────────────────────────
  @Post(':projectSlug/session')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crea una sesión anónima del widget y devuelve el token firmado',
  })
  async createSession(
    @Param('projectSlug') slug: string,
    @Req() req: Request,
    @Query('org') org?: string,
  ) {
    await this.enforce(
      `widget:session:ip:${req.ip}`,
      envInt('WIDGET_SESSIONS_PER_MIN_IP', 20),
      60,
    );
    const config = await this.resolveConfig(slug, org);
    this.assertAllowedOrigin(req, config.allowedOrigins);
    const issued = this.widgetSessions.issue(slug, config.organizationId);
    return { token: issued.token, expiresAt: issued.expiresAt.toISOString() };
  }

  // ── Chat del widget ───────────────────────────────────────────────────────
  @Post(':projectSlug/chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Enviar mensaje al asistente (requiere token de sesión del widget)',
  })
  async chat(
    @Param('projectSlug') slug: string,
    @Headers('x-widget-token') token: string | undefined,
    @Req() req: Request,
    @Body(new ZodValidationPipe(WidgetChatSchema)) dto: WidgetChatInput,
    @Query('org') org?: string,
  ) {
    const config = await this.resolveConfig(slug, org);
    this.assertAllowedOrigin(req, config.allowedOrigins);
    const sessionId = this.widgetSessions.verify(
      token,
      slug,
      config.organizationId,
    );

    // Límites ANTES de gastar LLM: por IP, por sesión y cuota diaria del proyecto
    await this.enforce(
      `widget:chat:ip:${req.ip}`,
      envInt('WIDGET_CHAT_PER_MIN_IP', 60),
      60,
    );
    await this.enforce(
      `widget:chat:sid:${sessionId}`,
      envInt('WIDGET_CHAT_PER_MIN_SESSION', 12),
      60,
    );
    await this.enforce(
      `widget:quota:${config.projectId}:${new Date().toISOString().slice(0, 10)}`,
      envInt('WIDGET_DAILY_QUOTA', 2000),
      86_400,
      'Este asistente alcanzó su límite diario de consultas. Probá de nuevo mañana.',
    );

    return this.chatService.chat({
      projectSlug: slug,
      organizationId: config.organizationId,
      ecosystemId: config.ecosystemId,
      userId: `widget:${sessionId}`,
      message: dto.message,
      channel: 'widget',
    });
  }

  // ── Historial de la sesión propia ─────────────────────────────────────────
  @Get(':projectSlug/session')
  @ApiOperation({
    summary: 'Recuperar el historial de la sesión del token (no acepta userId)',
  })
  async getSession(
    @Param('projectSlug') slug: string,
    @Headers('x-widget-token') token: string | undefined,
    @Req() req: Request,
    @Query('org') org?: string,
  ) {
    await this.enforce(
      `widget:history:ip:${req.ip}`,
      envInt('WIDGET_HISTORY_PER_MIN_IP', 30),
      60,
    );
    const config = await this.resolveConfig(slug, org);
    this.assertAllowedOrigin(req, config.allowedOrigins);
    const sessionId = this.widgetSessions.verify(
      token,
      slug,
      config.organizationId,
    );
    const session = await this.sessionService.findByUser(
      config.id,
      config.organizationId,
      `widget:${sessionId}`,
    );
    return {
      success: true,
      data: session
        ? { history: session.history, lastMessageAt: session.lastMessageAt }
        : null,
    };
  }

  // ── Snippet JS embeddable ─────────────────────────────────────────────────
  @Get(':projectSlug/snippet.js')
  @ApiOperation({
    summary: 'Script JS embeddable para incrustar el widget en cualquier web',
  })
  async getSnippet(
    @Param('projectSlug') slug: string,
    @Res() res: Response,
    @Query('org') org?: string,
  ) {
    const config = await this.resolveConfig(slug, org);
    const appUrl = process.env['APP_URL'] ?? 'http://localhost:3010';
    const snippet = this.buildSnippet({
      projectSlug: slug,
      organizationId: config.organizationId,
      apiUrl: `${appUrl}/api/v1`,
      personaName: config.personaName,
      welcomeMessage: config.welcomeMessage ?? '¡Hola! ¿En qué puedo ayudarte?',
    });
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(snippet);
  }

  /**
   * AssistantConfig.allowedOrigins: si el proyecto lista sitios, el widget solo responde a esos orígenes.
   * Vacío = cualquiera (comportamiento por defecto). No es autenticación (el Origin lo puede falsificar un script),
   * pero impide que otros sitios incrusten tu widget y gasten tu cuota desde un navegador.
   */
  private assertAllowedOrigin(
    req: Request,
    allowed: string[] | null | undefined,
  ): void {
    if (!allowed || allowed.length === 0) return;
    const origin = req.headers.origin;
    if (!origin || !allowed.includes(origin)) {
      throw new ForbiddenException('Origen no permitido para este asistente');
    }
  }

  // ── Rate limit → 429 con Retry-After ──────────────────────────────────────
  private async enforce(
    key: string,
    limit: number,
    windowSec: number,
    message?: string,
  ): Promise<void> {
    const result = await this.rateLimit.hit(key, limit, windowSec);
    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: 429,
          message: message ?? 'Demasiadas solicitudes. Esperá un momento.',
          retryAfterSec: result.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
        { cause: `rate-limit:${key}` },
      );
    }
  }

  // ── Resolver config por slug (el slug es único solo dentro de una organización) ──
  private resolveConfig(slug: string, organizationId?: string) {
    return this.widgetConfig.resolve(slug, organizationId);
  }

  // ── Snippet JS ────────────────────────────────────────────────────────────
  private buildSnippet(opts: {
    projectSlug: string;
    organizationId: string;
    apiUrl: string;
    personaName: string;
    welcomeMessage: string;
  }): string {
    return `
(function() {
  var API_URL      = ${toJsString(opts.apiUrl)};
  var PROJECT_SLUG = ${toJsString(opts.projectSlug)};
  var ORG_ID       = ${toJsString(opts.organizationId)};
  var PERSONA_NAME = ${toJsString(opts.personaName)};
  var WELCOME_MSG  = ${toJsString(opts.welcomeMessage)};
  var BASE = API_URL + '/widget/' + encodeURIComponent(PROJECT_SLUG);
  var QS   = '?org=' + encodeURIComponent(ORG_ID);
  var TOKEN_KEY = 'chatia_tok_' + PROJECT_SLUG;
  var token = null;
  try { token = localStorage.getItem(TOKEN_KEY); } catch (e) {}
  async function ensureSession(force) {
    if (token && !force) return token;
    var res = await fetch(BASE + '/session' + QS, { method: 'POST' });
    if (!res.ok) throw new Error('session ' + res.status);
    token = (await res.json()).token;
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
    return token;
  }
  var style = document.createElement('style');
  style.textContent = [
    '#chatia-widget { position:fixed; bottom:24px; right:24px; z-index:9999; font-family:system-ui,sans-serif; }',
    '#chatia-bubble { width:56px; height:56px; border-radius:50%; background:#6366f1; border:none; cursor:pointer; color:#fff; font-size:24px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,.2); }',
    '#chatia-box { display:none; flex-direction:column; width:340px; height:480px; background:#fff; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,.15); overflow:hidden; position:absolute; bottom:68px; right:0; }',
    '#chatia-box.open { display:flex; }',
    '#chatia-header { background:#6366f1; color:#fff; padding:14px 16px; font-weight:600; font-size:15px; }',
    '#chatia-messages { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:8px; }',
    '.chatia-msg { max-width:80%; padding:8px 12px; border-radius:12px; font-size:14px; line-height:1.5; }',
    '.chatia-msg.user { background:#6366f1; color:#fff; align-self:flex-end; border-bottom-right-radius:4px; }',
    '.chatia-msg.bot  { background:#f1f5f9; color:#1e293b; align-self:flex-start; border-bottom-left-radius:4px; }',
    '#chatia-input-row { display:flex; padding:10px; gap:8px; border-top:1px solid #e2e8f0; }',
    '#chatia-input { flex:1; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; }',
    '#chatia-send { background:#6366f1; color:#fff; border:none; border-radius:8px; padding:8px 14px; cursor:pointer; font-size:14px; }',
    '.chatia-typing { color:#94a3b8; font-size:13px; font-style:italic; align-self:flex-start; padding:4px 12px; }'
  ].join('');
  document.head.appendChild(style);
  var widget = document.createElement('div');
  widget.id = 'chatia-widget';
  widget.innerHTML = [
    '<button id="chatia-bubble" title="Abrir chat">💬</button>',
    '<div id="chatia-box">',
    '  <div id="chatia-header"></div>',
    '  <div id="chatia-messages"></div>',
    '  <div id="chatia-input-row">',
    '    <input id="chatia-input" maxlength="2000" placeholder="Escribí tu mensaje..." />',
    '    <button id="chatia-send">Enviar</button>',
    '  </div>',
    '</div>'
  ].join('');
  document.body.appendChild(widget);
  document.getElementById('chatia-header').textContent = PERSONA_NAME;
  var box      = document.getElementById('chatia-box');
  var messages = document.getElementById('chatia-messages');
  var input    = document.getElementById('chatia-input');
  var opened   = false;
  function addMsg(text, role) {
    var div = document.createElement('div');
    div.className = 'chatia-msg ' + role;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
  function setTyping(on) {
    var el = document.getElementById('chatia-typing-indicator');
    if (on && !el) {
      var t = document.createElement('div');
      t.id = 'chatia-typing-indicator';
      t.className = 'chatia-typing';
      t.textContent = PERSONA_NAME + ' está escribiendo...';
      messages.appendChild(t);
      messages.scrollTop = messages.scrollHeight;
    } else if (!on && el) { el.remove(); }
  }
  async function postChat(text) {
    return fetch(BASE + '/chat' + QS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-widget-token': await ensureSession(false) },
      body: JSON.stringify({ message: text })
    });
  }
  async function sendMessage() {
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'user');
    setTyping(true);
    try {
      var res = await postChat(text);
      if (res.status === 401) { await ensureSession(true); res = await postChat(text); }
      if (res.status === 429) { setTyping(false); addMsg('Estás enviando muchos mensajes. Esperá un momento.', 'bot'); return; }
      var data = await res.json();
      setTyping(false);
      addMsg(data.response || 'Error al obtener respuesta', 'bot');
    } catch(e) {
      setTyping(false);
      addMsg('Error de conexión. Intentá de nuevo.', 'bot');
    }
  }
  document.getElementById('chatia-bubble').addEventListener('click', function() {
    opened = !opened;
    box.classList.toggle('open', opened);
    if (opened && messages.children.length === 0) { addMsg(WELCOME_MSG, 'bot'); }
  });
  document.getElementById('chatia-send').addEventListener('click', sendMessage);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();
`.trim();
  }
}
