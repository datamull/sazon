// Caché simple en el disco temporal de la función (/tmp).
// Dura mientras la instancia siga activa; si se pierde, el índice se vuelve a armar (unos segundos).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIR = join(tmpdir(), "sazon-cache");

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(join(DIR, key + ".json"), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await mkdir(DIR, { recursive: true });
    await writeFile(join(DIR, key + ".json"), JSON.stringify(value));
  } catch (e) {
    console.warn("No se pudo guardar la caché", key, String(e));
  }
}
