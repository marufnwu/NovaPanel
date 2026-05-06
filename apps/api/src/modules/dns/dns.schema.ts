import { z } from 'zod';

/**
 * Record-type-specific value validation.
 * Applied after the generic createRecordSchema validates the basic shape.
 */
const recordValueValidation = z.object({
  type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR']),
  value: z.string().min(1),
}).refine(
  (data) => {
    switch (data.type) {
      case 'A':
        // Validate IPv4 address
        return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(data.value) &&
          data.value.split('.').every((octet) => parseInt(octet, 10) >= 0 && parseInt(octet, 10) <= 255);
      case 'AAAA':
        // Validate IPv6 address (basic check)
        return /^[0-9a-fA-F:]+$/.test(data.value) && data.value.length >= 2;
      case 'CNAME':
      case 'NS':
        // Validate domain format
        return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.$/.test(data.value) ||
          /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(data.value);
      case 'MX':
        // Validate domain format for exchange
        return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.$/.test(data.value) ||
          /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(data.value);
      case 'TXT':
        // Validate non-empty string (already ensured by min(1))
        return data.value.length > 0;
      case 'SRV':
        // SRV value format: priority weight port target
        return /^\d+\s+\d+\s+\d+\s+\S+$/.test(data.value);
      case 'CAA':
        // CAA value format: flag tag "value"
        return /^\d+\s+(issue|issuewild|iodef)\s+".*"$/.test(data.value);
      case 'PTR':
        // Validate domain format
        return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.?$/.test(data.value);
      default:
        return true;
    }
  },
  {
    message: 'Invalid value for the specified record type',
    path: ['value'],
  }
);

export const createRecordSchema = z.object({
  type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR']),
  name: z.string().min(1),
  value: z.string().min(1),
  ttl: z.number().min(60).max(86400).default(3600),
  priority: z.number().min(0).max(65535).optional(),
}).and(recordValueValidation);

export const updateRecordSchema = z.object({
  name: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
  ttl: z.number().min(60).max(86400).optional(),
  priority: z.number().min(0).max(65535).optional(),
});

export const importZoneSchema = z.object({
  bindFormat: z.string().min(1),
});
