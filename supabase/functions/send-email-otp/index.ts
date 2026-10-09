import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hashOtp(otp: string): Promise<string> {
  const data = new TextEncoder().encode(otp);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    // Only POST is allowed
    if (req.method !== "POST") {
      return Response.json(
        {
          error: "Only POST requests are allowed.",
        },
        {
          status: 405,
          headers: corsHeaders,
        }
      );
    }

    // Supabase environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    // New Supabase secret key format
    const secretKeysRaw =
      Deno.env.get("SUPABASE_SECRET_KEYS");

    // Legacy fallback
    let serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (secretKeysRaw) {
      try {
        const secretKeys = JSON.parse(secretKeysRaw);

        serviceRoleKey =
          secretKeys.default ||
          serviceRoleKey;
      } catch (error) {
        console.error(
          "Could not parse SUPABASE_SECRET_KEYS:",
          error
        );
      }
    }

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "Supabase server configuration is missing."
      );

      return Response.json(
        {
          error:
            "Supabase server configuration is missing.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // Create admin Supabase client
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // Optional user authentication (supports logged in or demo / pre-auth mode)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (token) {
        try {
          const { data: userData } = await supabaseAdmin.auth.getUser(token);
          if (userData?.user) {
            userId = userData.user.id;
          }
        } catch {
          // Token is anon key or not a user JWT, proceed with demo / unauthenticated flow
        }
      }
    }

    // Read request body
    const body = await req.json();

    const email = String(
      body.email ?? ""
    )
      .trim()
      .toLowerCase();

    // Validate email
    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return Response.json(
        {
          error:
            "Please enter a valid email address.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before storing
    const otpHash = await hashOtp(otp);

    // OTP expires after 5 minutes
    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    ).toISOString();

    // Save OTP challenge
    const { error: dbError } =
      await supabaseAdmin
        .from("email_otp_challenges")
        .insert({
          user_id: userId,
          email,
          otp_hash: otpHash,
          expires_at: expiresAt,
          attempts: 0,
        });

    if (dbError) {
      console.error(
        "Database error:",
        dbError.message
      );

      return Response.json(
        {
          error:
            "Could not create OTP challenge.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // Resend API key
    const resendApiKey =
      Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error(
        "RESEND_API_KEY is missing."
      );

      return Response.json(
        {
          error:
            "Email service is not configured.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // Send email through Resend
    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          from:
            "SecureVault <onboarding@resend.dev>",

          to: [email],

          subject:
            "SecureVault Email Verification Code",

          html: `
            <div style="font-family: Arial, sans-serif;">
              <h2>SecureVault Email Verification</h2>

              <p>Your verification code is:</p>

              <h1 style="letter-spacing: 6px;">
                ${otp}
              </h1>

              <p>
                This code expires in 5 minutes.
              </p>

              <p>
                If you did not request this code,
                you can ignore this email.
              </p>
            </div>
          `,
        }),
      }
    );

    if (!resendResponse.ok) {
      const errorText =
        await resendResponse.text();

      console.error(
        "Resend error:",
        errorText
      );

      let parsedMsg = "Could not send verification email.";
      try {
        const parsed = JSON.parse(errorText);
        if (parsed?.message) {
          parsedMsg = parsed.message;
        }
      } catch {}

      return Response.json(
        {
          error: parsedMsg,
        },
        {
          status: 502,
          headers: corsHeaders,
        }
      );
    }

    return Response.json(
      {
        success: true,
        message:
          "Verification code sent successfully.",
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error(
      "Unexpected error:",
      error
    );

    return Response.json(
      {
        error:
          "Unexpected server error.",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});