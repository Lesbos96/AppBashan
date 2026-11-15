-- u3-1: outbox_dispatch ist nur für den Cron (Eigentümer). service_role hat kein Recht auf Schema private, vault und net (Aufruf scheiterte mit 42501);
-- niemand ruft die Funktion als service_role auf, ein Grant würde nur den Zugriff auf vault.decrypted_secrets öffnen. Wie photo_publish_dispatch.
revoke execute on function public.outbox_dispatch() from service_role;
