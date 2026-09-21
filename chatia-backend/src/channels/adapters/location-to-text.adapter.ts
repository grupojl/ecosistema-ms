// chatia-backend/src/channels/adapters/location-to-text.adapter.ts
//
// Proveedor: OpenStreetMap Nominatim (gratuito, sin API key)
// Por qué OSM primero: gratuito, suficiente para reverse geocoding municipal
// Fallback: usar coordenadas directamente si OSM falla
//
// WhatsApp entrega la ubicación en el campo raw del IncomingMessage:
//   raw.location = { latitude: number, longitude: number, name?: string, address?: string }
//
// Ref: .claude/modules/chatia-backend/multimodal-adapters.md
import { Injectable, Logger } from '@nestjs/common';
import type { IMultimodalAdapter, MultimodalInput } from './multimodal.interface.js';

const NOMINATIM_URL  = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT     = 'chatia-backend/1.0'; // requerido por Nominatim ToS

interface WhatsAppLocation {
  latitude?:  number;
  longitude?: number;
  name?:      string;
  address?:   string;
}

@Injectable()
export class LocationToTextAdapter implements IMultimodalAdapter {
  readonly supportedType = 'location' as const;
  private readonly logger = new Logger(LocationToTextAdapter.name);

  async toText(input: MultimodalInput): Promise<string> {
    const location = this.extractLocation(input.raw);

    if (!location.latitude || !location.longitude) {
      return input.content || '[Ubicación recibida sin coordenadas]';
    }

    const { latitude: lat, longitude: lng } = location;

    // Si WhatsApp ya provee nombre/dirección, usarlos directamente
    if (location.name || location.address) {
      const parts = [location.name, location.address].filter(Boolean).join(', ');
      return `[Ubicación del usuario: ${parts} (${lat.toFixed(6)}, ${lng.toFixed(6)})]`;
    }

    // Reverse geocoding via OSM Nominatim
    try {
      const address = await this.reverseGeocode(lat, lng);
      this.logger.log(`[LOC] Geocoding exitoso: ${address}`);
      return `[Ubicación del usuario: ${address} (${lat.toFixed(6)}, ${lng.toFixed(6)})]`;
    } catch {
      this.logger.warn('[LOC] OSM Nominatim falló — usando coordenadas');
      return `[Ubicación del usuario: lat ${lat.toFixed(6)}, lng ${lng.toFixed(6)}]`;
    }
  }

  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&accept-language=es`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal:  AbortSignal.timeout(5_000),
    });

    if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);

    const data = await res.json() as { display_name?: string; address?: Record<string, string> };
    if (data.display_name) return data.display_name;

    // Construir dirección desde componentes si display_name no está
    const a = data.address ?? {};
    const parts = [
      a['road'] ? `${a['road']} ${a['house_number'] ?? ''}`.trim() : null,
      a['suburb'] ?? a['neighbourhood'],
      a['city'] ?? a['town'] ?? a['village'],
      a['state'],
    ].filter(Boolean);

    return parts.join(', ') || `${lat}, ${lng}`;
  }

  private extractLocation(raw: Record<string, unknown>): WhatsAppLocation {
    // WhatsApp Cloud API: raw.location
    if (raw['location'] && typeof raw['location'] === 'object') {
      return raw['location'] as WhatsAppLocation;
    }
    // Fallback: coordenadas en raíz del raw
    return {
      latitude:  raw['latitude']  as number | undefined,
      longitude: raw['longitude'] as number | undefined,
    };
  }
}
