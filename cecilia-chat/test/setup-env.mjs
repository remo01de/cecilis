// Die Routen legen beim Import den OpenRouter-Client an, der einen Schlüssel verlangt.
// Die Tests laufen ohne Netz und ohne .env, daher ein Platzhalter.
process.env.OPENROUTER_API_KEY ??= "test-ohne-netz";
