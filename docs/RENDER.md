# Render Deployment

1. Create a Web Service.
2. Connect the NEVU HQ repository.
3. Runtime: Node.
4. Build: `npm install && npm run build`.
5. Start: `npm start`.
6. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
7. Add `NEVU_BRIDGE_URL` only if a local bridge is being used.
8. Add `NEVU_BRIDGE_SECRET` as a secret if the bridge is enabled.
9. Deploy.
10. In Supabase Auth URL settings, add the Render URL and the final custom domain when you have one.
