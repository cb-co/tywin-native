import { describe, expect, it } from "vitest";
import { scrubPii } from "./scrub-pii";

const FIXTURE = `
American Express
Estado de cuenta de:
Fecha de Corte: 15-07-2026
JANE JANE SAMPLE DOE
Fecha límite de pago: 10-08-2026
 ****-****-****-1234        10,000.00      8,574.50        25/06/2026     20/07/2026       1,000.00
  25/06      25/06   74763946147620851045422       MERCADO UNO  CIUDAD FALSA                  500.00
                                                               5411   045602
- 1234 - 000000012473453 - 15-07-2026
American Express
JANE JANE SAMPLE DOE
jane.sample@example.com
Tel: 8091234567
Estamos a tu servicio en la Línea Platinum 809-227-3182 y 1-809-200-3182
JANE JANE SAMPLE DOE OBTENIDOS ACUMULADOS
No. de Tarjeta: ****1234
JANE JANE SAMPLE DOE
American Express
jane.sample@example.com
`;

describe("scrubPii", () => {
  const out = scrubPii(FIXTURE);

  it("redacts every email occurrence", () => {
    expect(out).not.toContain("jane.sample@example.com");
    expect(out.match(/\[EMAIL\]/g)?.length).toBe(2);
  });

  it("redacts labeled and dash-grouped phone numbers, but never a dash-grouped date", () => {
    expect(out).not.toContain("8091234567");
    expect(out).not.toContain("809-227-3182");
    expect(out).not.toContain("1-809-200-3182");
    expect(out).toContain("Fecha de Corte: 15-07-2026");
    expect(out).toContain("Fecha límite de pago: 10-08-2026");
  });

  it("redacts the name everywhere, including the header-glued variant", () => {
    expect(out).not.toContain("JANE JANE SAMPLE DOE");
  });

  it("redacts the hidden doc-id artifact line", () => {
    expect(out).not.toContain("000000012473453");
  });

  it("never redacts a recurring card-network brand name", () => {
    expect(out.match(/American Express/g)?.length).toBe(3);
  });

  it("leaves transaction data, references, MCCs, and balance figures untouched", () => {
    expect(out).toContain("74763946147620851045422");
    expect(out).toContain("MERCADO UNO");
    expect(out).toContain("500.00");
    expect(out).toContain("5411   045602");
    expect(out).toContain("10,000.00");
    expect(out).toContain("8,574.50");
    expect(out).toContain("****-****-****-1234");
  });
});
