// chatia-backend/src/contacts/dto/update-contact.dto.ts
// DTO de entrada para PATCH /contacts/:id
// Los controllers usan ZodValidationPipe inline (ADR-001).
export interface UpdateContactDto {
  name?:     string;
  email?:    string;
  status?:   string;
  tags?:     string[];
  optedOut?: boolean;
}
