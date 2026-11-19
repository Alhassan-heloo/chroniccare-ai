import { config } from "zod";

// Configure before application schemas are constructed. Validation stays enabled;
// only optional runtime code generation is disabled under script-src 'self'.
config({ jitless: true });
