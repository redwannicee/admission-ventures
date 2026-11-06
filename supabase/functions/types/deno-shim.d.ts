// Type-check shim: lets `tsc` validate Edge Functions without a Deno install.
// The real runtime is Deno on Supabase; this only declares what the functions use.
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};
declare module "npm:@supabase/supabase-js@2.45.4" {
  export * from "@supabase/supabase-js";
}
