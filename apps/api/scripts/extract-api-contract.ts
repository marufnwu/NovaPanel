import fs from "fs";
import path from "path";
import { Project } from "ts-morph";

const project = new Project({ tsConfigFilePath: "tsconfig.json" });
const apiDir = path.resolve("app/api"); // or pages/api

interface RouteContract {
  path: string;
  method: string;
  requestBody: string[];
  queryParams: string[];
  responseShape: string[];
  statusCodes: number[];
}

function extractRoutes(dir: string): RouteContract[] {
  const contracts: RouteContract[] = [];

  const walk = (current: string, routePrefix: string) => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full, `${routePrefix}/${entry.name}`);
      } else if (entry.name === "route.ts" || entry.name === "route.js") {
        const source = project.addSourceFileAtPath(full);
        const exports = source.getExportedDeclarations();

        for (const [name] of exports) {
          const method = name.toUpperCase();
          if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method))
            continue;

          contracts.push({
            path: routePrefix,
            method,
            requestBody: extractRequestBody(source, name),
            queryParams: extractQueryParams(source, name),
            responseShape: extractResponseFields(source, name),
            statusCodes: extractStatusCodes(source, name),
          });
        }
      }
    }
  };

  walk(dir, "/api");
  return contracts;
}

function extractRequestBody(source: any, fnName: string): string[] {
  // Look for destructuring from req.json() or zod schema
  const text = source.getText();
  const jsonMatch = text.match(/await request\.json\(\)[\s\S]{0,200}/);
  if (!jsonMatch) return [];
  const destructure = jsonMatch[0].match(/\{([^}]+)\}/);
  return destructure ? destructure[1].split(",").map((s: string) => s.trim()) : [];
}

function extractQueryParams(source: any, fnName: string): string[] {
  const text = source.getText();
  const matches = text.match(/searchParams\.get\(['"`](\w+)['"`]\)/g) || [];
  return matches.map((m: string) => m.match(/['"`](\w+)['"`]/)?.[1] ?? "");
}

function extractResponseFields(source: any, fnName: string): string[] {
  const text = source.getText();
  const jsonMatch = text.match(/NextResponse\.json\(\{([^}]+)\}/);
  if (!jsonMatch) return [];
  return jsonMatch[1].split(",").map((s: string) => s.trim().split(":")[0].trim());
}

function extractStatusCodes(source: any, fnName: string): number[] {
  const text = source.getText();
  const matches = text.match(/status:\s*(\d{3})/g) || [];
  return [...new Set(matches.map((m: string) => parseInt(m.match(/\d{3}/)?.[0] ?? "200")))];
}

const contracts = extractRoutes(apiDir);
fs.writeFileSync(
  "api-contract.json",
  JSON.stringify(contracts, null, 2),
  "utf-8"
);
console.log(`Extracted ${contracts.length} route contracts → api-contract.json`);