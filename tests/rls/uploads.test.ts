// Fotos vor dem Absenden (Migration 0020) gegen das Dev-Projekt: Staging-Pfad {uid}/{client_ref}/{id}.jpg, Übernahme durch quote_save_request,
// Sperren nach dem Absenden und Aufräumen. Je Regel erlaubt UND verweigert, mit genauem Fehler. Start: npm run test:rls. Nie gegen Produktion.
// Der Rot-Beweis jeder Sperre steht in scripts/redproof-s9a4.mjs.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  deleteUsers,
  makeUser,
  must,
  requestArgs,
  service,
  type TestUser,
} from "../support/db.ts";
import { ownerSql, probes } from "../support/owner.ts";
import { vaultMissing } from "../support/cleanup.ts";
import {
  baseDeps,
  call,
  cleanupQuoteRls,
  initCtx,
} from "../support/quote-rls.ts";
import { moveCall } from "../support/quote.ts";

const BUCKET = "request-photos";
const bytes = Uint8Array.from(
  atob(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  ),
  (c) => c.charCodeAt(0),
);
const JPEG = { contentType: "image/jpeg" };
const DENIED = {
  statusCode: "403",
  message: "new row violates row-level security policy",
};

let a: TestUser;
let b: TestUser;
const paths: string[] = [];

const pathOf = (user: TestUser, ref: string, id: string) =>
  `${user.id}/${ref}/${id}.jpg`;
/** Lädt als `user` in den Staging-Ordner `ref` (Normalfall: ok). */
const stage = async (user: TestUser, ref: string, id = crypto.randomUUID()) => {
  const path = pathOf(user, ref, id);
  const r = await user.db.storage.from(BUCKET).upload(path, bytes, JPEG);
  if (!r.error) paths.push(path);
  return { id, path, error: r.error };
};
const stageOk = async (user: TestUser, ref: string) => {
  const s = await stage(user, ref);
  expect(s.error).toBeNull();
  return s;
};
const exists = async (path: string) =>
  (await service.storage.from(BUCKET).download(path)).error === null;
const photoRows = async (requestId: string) =>
  must(
    await service
      .from("request_photos")
      .select("id, storage_path")
      .eq("request_id", requestId),
  );
const requestRows = async (ref: string) =>
  must(
    await service.from("service_requests").select("id").eq("client_ref", ref),
  );
const save = async (user: TestUser, ref: string, ids: string[]) =>
  service.rpc(
    "quote_save_request",
    (await requestArgs(user.id, {
      p_client_ref: ref,
      p_photo_ids: ids,
    })) as never,
  );
const saved = async (user: TestUser, ref: string, ids: string[]) =>
  (
    must(await save(user, ref, ids)) as unknown as {
      id: string;
      created: boolean;
    }[]
  )[0]!;
const age = (path: string, hours: number) =>
  ownerSql(
    `update storage.objects set created_at = now() - interval '${hours} hours' where bucket_id = '${BUCKET}' and name = '${path}' returning name`,
  );

beforeAll(async () => {
  a = await makeUser("stage-a");
  b = await makeUser("stage-b");
});

afterAll(async () => {
  for (let i = 0; i < paths.length; i += 100)
    await service.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  await deleteUsers();
});

describe("Staging hochladen (storage.objects)", () => {
  it("erlaubt: der Eigentümer lädt in den eigenen Ordner ohne Anfrage, liest per signiertem Link; der Bucket ist privat", async () => {
    const ref = crypto.randomUUID();
    const s = await stageOk(a, ref);
    const signed = must(
      await a.db.storage.from(BUCKET).createSignedUrl(s.path, 60),
    );
    expect((await fetch(signed.signedUrl)).ok).toBe(true);
    expect(
      (
        await fetch(
          signed.signedUrl
            .split("?")[0]!
            .replace("/object/sign/", "/object/public/"),
        )
      ).ok,
    ).toBe(false);
    expect(
      (await b.db.storage.from(BUCKET).createSignedUrl(s.path, 60)).error,
    ).toMatchObject({ message: "Object not found" });
  });

  it("verweigert: fremder Ordner (b lädt in den Ordner von a), anon", async () => {
    const ref = crypto.randomUUID();
    const own = crypto.randomUUID();
    expect(
      (await b.db.storage.from(BUCKET).upload(pathOf(a, ref, own), bytes, JPEG))
        .error,
    ).toMatchObject(DENIED);
    expect(
      (await anon.storage.from(BUCKET).upload(pathOf(a, ref, own), bytes, JPEG))
        .error,
    ).toMatchObject(DENIED);
    expect(await exists(pathOf(a, ref, own))).toBe(false);
  });

  it("verweigert: falsche Pfadform (Großbuchstaben, andere Endung, ohne client_ref-Ordner, kein UUID, Pfadtrick)", async () => {
    const ref = crypto.randomUUID();
    const id = crypto.randomUUID();
    for (const name of [
      pathOf(a, ref, id).toUpperCase(),
      `${a.id}/${ref}/${id}.png`,
      `${a.id}/${id}.jpg`,
      `${a.id}/${ref}/foto.jpg`,
      `${a.id}/not-a-uuid/${id}.jpg`,
      `${a.id}/${ref}/../${id}.jpg`,
      `${a.id}/${ref}/x/${id}.jpg`,
    ]) {
      const r = await a.db.storage.from(BUCKET).upload(name, bytes, JPEG);
      expect(r.error, name).not.toBeNull();
    }
  });

  it("verweigert: fremder Nutzer liest, überschreibt, löscht, verschiebt nicht; anon bekommt nichts; die Datei bleibt unverändert", async () => {
    const ref = crypto.randomUUID();
    const s = await stageOk(a, ref);
    const before = Buffer.from(
      await must(
        await service.storage.from(BUCKET).download(s.path),
      ).arrayBuffer(),
    );

    expect(
      (await b.db.storage.from(BUCKET).download(s.path)).error,
    ).not.toBeNull();
    expect(
      (
        await b.db.storage
          .from(BUCKET)
          .upload(s.path, bytes, { ...JPEG, upsert: true })
      ).error,
    ).toMatchObject({ statusCode: "403" });
    expect(
      (await b.db.storage.from(BUCKET).update(s.path, bytes, JPEG)).error,
    ).not.toBeNull();
    expect(must(await b.db.storage.from(BUCKET).remove([s.path]))).toEqual([]);
    expect(
      (
        await b.db.storage
          .from(BUCKET)
          .move(s.path, `${b.id}/${ref}/${crypto.randomUUID()}.jpg`)
      ).error,
    ).not.toBeNull();
    expect(
      (
        await b.db.storage
          .from(BUCKET)
          .copy(s.path, `${b.id}/${ref}/${crypto.randomUUID()}.jpg`)
      ).error,
    ).not.toBeNull();
    expect(
      (await b.db.storage.from(BUCKET).list(`${a.id}/${ref}`)).data ?? [],
    ).toEqual([]);
    expect(
      (await anon.storage.from(BUCKET).download(s.path)).error,
    ).not.toBeNull();
    expect(
      (await anon.storage.from(BUCKET).remove([s.path])).data ?? [],
    ).toEqual([]);

    expect(
      Buffer.from(
        await must(
          await service.storage.from(BUCKET).download(s.path),
        ).arrayBuffer(),
      ),
    ).toEqual(before);
  });

  it("erlaubt: der Eigentümer löscht sein Staging-Foto; verweigert: Überschreiben der eigenen Datei (kein UPDATE-Recht)", async () => {
    const ref = crypto.randomUUID();
    const s = await stageOk(a, ref);
    expect(
      (
        await a.db.storage
          .from(BUCKET)
          .upload(s.path, bytes, { ...JPEG, upsert: true })
      ).error,
    ).toMatchObject({ statusCode: "403" });
    expect(must(await a.db.storage.from(BUCKET).remove([s.path]))).toHaveLength(
      1,
    );
    expect(await exists(s.path)).toBe(false);
  });

  it("zu groß: der Bucket lehnt ab (413); falscher Typ: PNG, WebP, HEIC, Text (415)", async () => {
    const ref = crypto.randomUUID();
    const big = await a.db.storage
      .from(BUCKET)
      .upload(
        pathOf(a, ref, crypto.randomUUID()),
        new Uint8Array(11 * 1024 * 1024),
        JPEG,
      );
    expect(big.error).toMatchObject({
      statusCode: "413",
      message: "The object exceeded the maximum allowed size",
    });
    for (const type of [
      "image/png",
      "image/webp",
      "image/heic",
      "text/plain",
    ]) {
      const r = await a.db.storage
        .from(BUCKET)
        .upload(pathOf(a, ref, crypto.randomUUID()), bytes, {
          contentType: type,
        });
      expect(r.error, type).toMatchObject({
        statusCode: "415",
        message: `mime type ${type} is not supported`,
      });
    }
  });
});

describe("Übernahme beim Absenden (quote_save_request)", () => {
  it("erlaubt: eigene, frische Fotos werden atomar als request_photos übernommen; nur der Eigentümer liest sie", async () => {
    const ref = crypto.randomUUID();
    const s1 = await stageOk(a, ref);
    const s2 = await stageOk(a, ref);
    const r = await saved(a, ref, [s1.id, s2.id]);
    expect(r.created).toBe(true);
    expect((await photoRows(r.id)).map((p) => p.storage_path).sort()).toEqual(
      [s1.path, s2.path].sort(),
    );
    expect(
      must(
        await a.db
          .from("request_photos")
          .select("storage_path")
          .eq("request_id", r.id),
      ),
    ).toHaveLength(2);
    expect(
      must(
        await b.db
          .from("request_photos")
          .select("storage_path")
          .eq("request_id", r.id),
      ),
    ).toEqual([]);
    expect(
      (await anon.from("request_photos").select("id")).error,
    ).toMatchObject({ code: "42501" });
  });

  it("doppelte IDs ergeben ein Foto; ohne Fotos geht es auch (Gegenfall)", async () => {
    const ref = crypto.randomUUID();
    const s = await stageOk(a, ref);
    expect(
      await photoRows((await saved(a, ref, [s.id, s.id])).id),
    ).toHaveLength(1);
    expect(
      await photoRows((await saved(a, crypto.randomUUID(), [])).id),
    ).toEqual([]);
  });

  it("verweigert: fremde Foto-ID (Datei von b) → photo_missing, keine Anfrage, keine Zeile", async () => {
    const ref = crypto.randomUUID();
    const foreign = await stageOk(b, ref);
    const own = await stageOk(a, ref);
    const r = await save(a, ref, [own.id, foreign.id]);
    expect(r.error).toMatchObject({ code: "P0001", message: "photo_missing" });
    expect(await requestRows(ref)).toEqual([]);
    expect(
      must(
        await service
          .from("request_photos")
          .select("id")
          .in("storage_path", [own.path, foreign.path]),
      ),
    ).toEqual([]);
  });

  it("verweigert: Foto aus einem anderen eigenen Ordner und nie hochgeladene ID → photo_missing", async () => {
    const other = await stageOk(a, crypto.randomUUID());
    for (const id of [other.id, crypto.randomUUID()]) {
      const ref = crypto.randomUUID();
      expect((await save(a, ref, [id])).error).toMatchObject({
        code: "P0001",
        message: "photo_missing",
      });
      expect(await requestRows(ref)).toEqual([]);
    }
  });

  it("verweigert: abgelaufenes Staging-Foto → photo_expired, nichts gespeichert; Gegenfall kurz vor Ablauf wird übernommen", async () => {
    const ref = crypto.randomUUID();
    const fresh = await stageOk(a, ref);
    const old = await stageOk(a, ref);
    expect(age(old.path, 25)).toHaveLength(1);
    expect((await save(a, ref, [fresh.id, old.id])).error).toMatchObject({
      code: "P0001",
      message: "photo_expired",
    });
    expect(await requestRows(ref)).toEqual([]);
    expect(age(old.path, 23)).toHaveLength(1);
    expect(
      await photoRows((await saved(a, ref, [fresh.id, old.id])).id),
    ).toHaveLength(2);
  });

  it("Grenze: 8 Fotos gehen, 9 → too_many_photos ohne Anfrage", async () => {
    const ref = crypto.randomUUID();
    const ids: string[] = [];
    for (let i = 0; i < 9; i++) ids.push((await stageOk(a, ref)).id);
    expect((await save(a, ref, ids)).error).toMatchObject({
      code: "P0001",
      message: "too_many_photos",
    });
    expect(await requestRows(ref)).toEqual([]);
    expect(
      await photoRows((await saved(a, ref, ids.slice(0, 8))).id),
    ).toHaveLength(8);
  });

  it("Wiederholung derselben client_ref liefert die vorhandene Anfrage und fügt keine Fotos hinzu", async () => {
    const ref = crypto.randomUUID();
    const first = await stageOk(a, ref);
    const r = await saved(a, ref, [first.id]);
    expect((await stage(a, ref)).error).toMatchObject(DENIED); // Staging ist nach dem Absenden zu (siehe unten)
    const again = await saved(a, ref, [first.id, crypto.randomUUID()]);
    expect(again).toMatchObject({ id: r.id, created: false });
    expect(await photoRows(r.id)).toHaveLength(1);
  });

  it("Handler: photoIds werden übernommen (200), fremde ID → 422 photo_missing, 9 → 422 too_many_photos, kein Array → 400, nichts gespeichert", async () => {
    await initCtx();
    const ref = crypto.randomUUID();
    const s = await stageOk(a, ref);
    const ok = await call(
      a,
      moveCall({ clientRef: ref, photoIds: [s.id] }),
      baseDeps,
    );
    expect(ok.status).toBe(200);
    expect(await photoRows(ok.body.id)).toHaveLength(1);

    const ref2 = crypto.randomUUID();
    const foreign = await stageOk(b, ref2);
    expect(
      await call(
        a,
        moveCall({ clientRef: ref2, photoIds: [foreign.id] }),
        baseDeps,
      ),
    ).toMatchObject({ status: 422, body: { error: "photo_missing" } });
    expect(await requestRows(ref2)).toEqual([]);

    const ref3 = crypto.randomUUID();
    expect(
      await call(
        a,
        moveCall({
          clientRef: ref3,
          photoIds: Array.from({ length: 9 }, () => crypto.randomUUID()),
        }),
        baseDeps,
      ),
    ).toMatchObject({ status: 422, body: { error: "too_many_photos" } });
    expect(
      await call(a, moveCall({ clientRef: ref3, photoIds: "x" }), baseDeps),
    ).toMatchObject({ status: 400, body: { error: "invalid_input" } });
    expect(
      await call(
        a,
        moveCall({ clientRef: ref3, photoIds: ["nicht-uuid"] }),
        baseDeps,
      ),
    ).toMatchObject({ status: 400, body: { error: "invalid_input" } });
    expect(await requestRows(ref3)).toEqual([]);
    await cleanupQuoteRls();
  });

  it("photo_staging_hours fehlt: Absenden (SQL) und Waisenliste scheitern mit setting_missing; mit Wert läuft beides (Positivkontrolle)", async () => {
    const setup = `alter table public.platform_settings disable trigger user; delete from public.platform_settings where key = 'photo_staging_hours'`;
    const steps = [
      {
        name: "quote_save_request",
        sql: `perform public.quote_save_request(p_customer => '${a.id}', p_client_ref => gen_random_uuid(), p_service => 'move', p_inputs => '{}', p_snapshot => '{"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"x"}}', p_price_version => 1, p_total => 1, p_low => 1, p_high => 1, p_from_address => null, p_from_lon => null, p_from_lat => null, p_to_address => null, p_to_lon => null, p_to_lat => null, p_route => null, p_region => null, p_district => 1::smallint, p_preferred_date => current_date + 14, p_time_window => null, p_description => null, p_volume => null, p_contact => '{"name":"x","phone":"123456","email":"x@y.at"}', p_confirmed => '{}', p_photo_ids => null)`,
        as: "service_role" as const,
      },
      {
        name: "photo_orphans",
        sql: "perform * from public.photo_orphans()",
        as: "service_role" as const,
      },
      {
        name: "interval",
        sql: "perform public.photo_staging_interval()",
        as: "service_role" as const,
      },
    ];
    const missing = probes(setup, steps);
    expect(missing["quote_save_request"]).toBe("P0001: setting_missing");
    expect(missing["photo_orphans"]).toBe("P0001: setting_missing");
    expect(missing["interval"]).toBe("P0001: setting_missing");
    expect(
      probes("select 1", [
        {
          name: "interval",
          sql: "=extract(epoch from public.photo_staging_interval())",
          as: "service_role",
        },
      ])["interval"],
    ).toBe("= 86400.000000");
  });
});

describe("Nach dem Absenden", () => {
  let ref: string;
  let requestId: string;
  let photo: { id: string; path: string };
  let other: string;
  let unlisted: { id: string; path: string };

  beforeAll(async () => {
    ref = crypto.randomUUID();
    photo = await stageOk(a, ref);
    unlisted = await stageOk(a, ref); // hochgeladen, aber beim Absenden nicht genannt
    requestId = (await saved(a, ref, [photo.id])).id;
    other = (await saved(a, crypto.randomUUID(), [])).id;
  });

  it("verweigert: Hinzufügen in den Ordner (403), auch mit neuer Datei", async () => {
    const r = await a.db.storage
      .from(BUCKET)
      .upload(pathOf(a, ref, crypto.randomUUID()), bytes, JPEG);
    expect(r.error).toMatchObject(DENIED);
  });

  it("verweigert: Löschen einer nicht genannten Datei im Ordner mit Anfrage (nur die Anfrage-Bedingung schützt sie, keine Zeile)", async () => {
    expect(
      must(await a.db.storage.from(BUCKET).remove([unlisted.path])),
    ).toEqual([]);
    expect(await exists(unlisted.path)).toBe(true);
  });

  it("verweigert: Löschen, Ersetzen und Verschieben der übernommenen Datei; sie bleibt unverändert", async () => {
    expect(must(await a.db.storage.from(BUCKET).remove([photo.path]))).toEqual(
      [],
    );
    expect(
      (
        await a.db.storage
          .from(BUCKET)
          .upload(photo.path, bytes, { ...JPEG, upsert: true })
      ).error,
    ).toMatchObject({ statusCode: "403" });
    expect(
      (await a.db.storage.from(BUCKET).update(photo.path, bytes, JPEG)).error,
    ).not.toBeNull();
    expect(
      (
        await a.db.storage
          .from(BUCKET)
          .move(photo.path, pathOf(a, crypto.randomUUID(), photo.id))
      ).error,
    ).not.toBeNull();
    expect(await exists(photo.path)).toBe(true);
  });

  it("verweigert (request_photos): Kunde und anon fügen weder ein noch ändern oder löschen sie (42501)", async () => {
    const denied = {
      code: "42501",
      message: "permission denied for table request_photos",
    };
    for (const [who, db] of [
      ["kunde", a.db],
      ["anon", anon],
    ] as const) {
      expect(
        (
          await db
            .from("request_photos")
            .insert({
              request_id: requestId,
              storage_path: pathOf(a, ref, crypto.randomUUID()),
            })
        ).error,
        `${who} insert`,
      ).toMatchObject(who === "anon" ? { code: "42501" } : denied);
      expect(
        (
          await db
            .from("request_photos")
            .update({ request_id: other })
            .eq("storage_path", photo.path)
        ).error,
        `${who} update`,
      ).toMatchObject({ code: "42501" });
      expect(
        (
          await db
            .from("request_photos")
            .delete()
            .eq("storage_path", photo.path)
        ).error,
        `${who} delete`,
      ).toMatchObject({ code: "42501" });
    }
    expect(await photoRows(requestId)).toHaveLength(1);
  });

  it("verweigert für service_role: Umhängen auf eine andere Anfrage, Ersetzen, Löschen (Rechte entzogen, 42501); Einfügen am Funktionspfad vorbei (Trigger)", async () => {
    const r = await service
      .from("request_photos")
      .update({ request_id: other })
      .eq("storage_path", photo.path);
    expect(r.error).toMatchObject({
      code: "42501",
      message: "permission denied for table request_photos",
    });
    expect(
      (
        await service
          .from("request_photos")
          .update({ storage_path: `${a.id}/${ref}/x.jpg` })
          .eq("storage_path", photo.path)
      ).error,
    ).toMatchObject({ code: "42501" });
    expect(
      (
        await service
          .from("request_photos")
          .delete()
          .eq("storage_path", photo.path)
      ).error,
    ).toMatchObject({ code: "42501" });
    expect(
      (
        await service
          .from("request_photos")
          .insert({
            request_id: requestId,
            storage_path: pathOf(a, ref, crypto.randomUUID()),
          })
      ).error,
    ).toMatchObject({ code: "P0001", message: "photo_insert_forbidden" });
    expect(await photoRows(requestId)).toHaveLength(1);
    expect(await photoRows(other)).toEqual([]);
  });

  it("Trigger auch für den Eigentümer: UPDATE (Umhängen, Ersetzen), DELETE und TRUNCATE → photo_immutable; INSERT ohne Marker → photo_insert_forbidden", async () => {
    const res = probes("select 1", [
      {
        name: "umhängen",
        sql: `update public.request_photos set request_id = '${other}' where storage_path = '${photo.path}'`,
      },
      {
        name: "ersetzen",
        sql: `update public.request_photos set storage_path = storage_path || 'x' where storage_path = '${photo.path}'`,
      },
      {
        name: "löschen",
        sql: `delete from public.request_photos where storage_path = '${photo.path}'`,
      },
      { name: "truncate", sql: "truncate public.request_photos" },
      {
        name: "einfügen",
        sql: `insert into public.request_photos (request_id, storage_path) values ('${requestId}', '${a.id}/${ref}/${crypto.randomUUID()}.jpg')`,
      },
      {
        name: "fremder pfad",
        sql: `perform set_config('app.mv_photo_request', '${requestId}', true); insert into public.request_photos (request_id, storage_path) values ('${requestId}', '${b.id}/${ref}/${crypto.randomUUID()}.jpg')`,
      },
    ]);
    expect(res).toEqual({
      umhängen: "P0001: photo_immutable",
      ersetzen: "P0001: photo_immutable",
      löschen: "P0001: photo_immutable",
      truncate: "P0001: photo_immutable",
      einfügen: "P0001: photo_insert_forbidden",
      "fremder pfad": "P0001: photo_insert_forbidden",
    });
  });

  it("Kaskade: Löschen der Anfrage entfernt die Zeilen (Positivkontrolle der DELETE-Ausnahme)", async () => {
    // service_requests löscht niemand direkt (request_delete_guard): die Kaskade läuft über das Konto
    const doomed = await makeUser("stage-doomed");
    const dref = crypto.randomUUID();
    const s = await stageOk(doomed, dref);
    const rid = (await saved(doomed, dref, [s.id])).id;
    expect(await photoRows(rid)).toHaveLength(1);
    expect((await service.auth.admin.deleteUser(doomed.id)).error).toBeNull();
    expect(await photoRows(rid)).toEqual([]);
  });
});

// Die Waisen-Tests stoßen den echten Aufräumjob nie an (der Rot-Beweis lockert photo_orphans, die Edge Function würde frische Fixtures löschen).
describe("Waisenliste", () => {
  it("Waisen-Liste und Aufräumjob sind nur für service_role aufrufbar (verweigert für anon und Kunden)", async () => {
    for (const fn of ["photo_orphans", "photo_cleanup"] as const) {
      expect((await anon.rpc(fn)).error, `anon ${fn}`).toMatchObject({
        code: "42501",
      });
      expect((await a.db.rpc(fn)).error, `kunde ${fn}`).toMatchObject({
        code: "42501",
      });
    }
    expect((await service.rpc("photo_orphans")).error).toBeNull();
    expect((await anon.rpc("photo_staging_interval")).error).toMatchObject({
      code: "42501",
    });
    expect((await a.db.rpc("photo_staging_interval")).error).toMatchObject({
      code: "42501",
    });
  });

  it("Waisen-Liste: nur abgelaufene Dateien ohne Zeile (frisch und übernommen bleiben draußen)", async () => {
    const ref = crypto.randomUUID();
    const fresh = await stageOk(a, ref);
    const expired = await stageOk(a, ref);
    const adopted = await stageOk(a, ref);
    age(expired.path, 26);
    age(adopted.path, 25 - 2); // übernehmbar; danach altern lassen
    await saved(a, ref, [adopted.id]);
    age(adopted.path, 30);
    const names = must(await service.rpc("photo_orphans")).map((o) => o.name);
    expect(names).toContain(expired.path);
    expect(names).not.toContain(fresh.path);
    expect(names).not.toContain(adopted.path);
  });
});

describe("Aufräumen", () => {
  // Ohne Vault-Einträge scheitert photo_cleanup (Migration 0014): klare Meldung statt unverständlichem Fehler, nie überspringen.
  beforeAll(async () => {
    const { error } = await service.rpc("photo_cleanup");
    const missing = vaultMissing(error);
    if (missing) throw missing;
  });

  it("Aufräumen löscht abgelaufene, nicht übernommene Dateien (Objekt), übernommene und frische bleiben", async () => {
    const ref = crypto.randomUUID();
    const fresh = await stageOk(a, ref);
    const expired = await stageOk(a, ref);
    const adopted = await stageOk(a, ref);
    age(expired.path, 26);
    await saved(a, ref, [adopted.id]);
    age(adopted.path, 30);
    expect((await service.rpc("photo_cleanup")).error).toBeNull();
    // pg_net ruft die Edge Function asynchron auf
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline && (await exists(expired.path)))
      await new Promise((r) => setTimeout(r, 3000));
    expect(await exists(expired.path)).toBe(false);
    expect(await exists(fresh.path)).toBe(true);
    expect(await exists(adopted.path)).toBe(true);
    expect(
      must(
        await service
          .from("request_photos")
          .select("id")
          .eq("storage_path", adopted.path),
      ),
    ).toHaveLength(1);
  }, 90_000);
});
