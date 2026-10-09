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
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

Deno.serve(async (req: Request) => {
  // -----------------------------
  // CORS
  // -----------------------------
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    // -----------------------------
    // ONLY POST
    // -----------------------------
    if (req.method !== "POST") {
      return Response.json(
        {
          success: false,
          verified: false,
          error: "Only POST requests are allowed.",
        },
        {
          status: 405,
          headers: corsHeaders,
        }
      );
    }

    // -----------------------------
    // SUPABASE SERVER CONFIG
    // -----------------------------
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    let serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!serviceRoleKey) {
      const secretKeys =
        Deno.env.get("SUPABASE_SECRET_KEYS");

      if (secretKeys) {
        try {
          const parsed = JSON.parse(secretKeys);

          if (
            parsed &&
            typeof parsed === "object"
          ) {
            serviceRoleKey =
              parsed.service_role_key ||
              parsed.serviceRoleKey ||
              parsed.secret_key ||
              null;
          }
        } catch (error) {
          console.error(
            "Could not parse SUPABASE_SECRET_KEYS:",
            error
          );
        }
      }
    }

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return Response.json(
        {
          success: false,
          verified: false,
          error:
            "Supabase server configuration is missing.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    const supabaseAdmin =
      createClient(
        supabaseUrl,
        serviceRoleKey
      );

    // Optional user check (supports authenticated or demo / pre-auth mode)
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
          // Token is anon key or not a user JWT
        }
      }
    }

    // -----------------------------
    // REQUEST BODY
    // -----------------------------
    const body = await req.json();

    const email = String(
      body?.email ?? ""
    )
      .trim()
      .toLowerCase();

    const otp = String(
      body?.otp ?? ""
    ).trim();

    // -----------------------------
    // EMAIL VALIDATION
    // -----------------------------
    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return Response.json(
        {
          success: false,
          verified: false,
          error:
            "Please enter a valid email address.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // -----------------------------
    // OTP VALIDATION
    // -----------------------------
    if (!/^\d{6}$/.test(otp)) {
      return Response.json(
        {
          success: false,
          verified: false,
          error:
            "OTP must be a 6-digit number.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // -----------------------------
    // FIND LATEST ACTIVE OTP CHALLENGE
    // -----------------------------
    let query = supabaseAdmin
      .from("email_otp_challenges")
      .select(
        "id,user_id,email,otp_hash,expires_at,attempts,verified_at,created_at"
      )
      .eq("email", email)
      .is("verified_at", null)
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const {
      data: challenge,
      error: challengeError,
    } = await query.maybeSingle();

    if (challengeError) {
      console.error(
        "Challenge lookup error:",
        challengeError.message
      );

      return Response.json(
        {
          success: false,
          verified: false,
          error:
            "Could not verify the OTP.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // -----------------------------
    // NO OTP
    // -----------------------------
    if (!challenge) {
      return Response.json(
        {
          success: false,
          verified: false,
          error:
            "No active verification code found. Please request a new OTP.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // -----------------------------
    // CHECK OTP EXPIRY
    // -----------------------------
    const expiresAt =
      new Date(
        challenge.expires_at
      ).getTime();

    if (
      Number.isNaN(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      return Response.json(
        {
          success: false,
          verified: false,
          error:
            "This OTP has expired. Please request a new one.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // -----------------------------
    // CHECK ATTEMPTS
    // -----------------------------
    const attempts =
      Number(challenge.attempts ?? 0);

    if (attempts >= 5) {
      return Response.json(
        {
          success: false,
          verified: false,
          error:
            "Too many incorrect attempts. Please request a new OTP.",
        },
        {
          status: 429,
          headers: corsHeaders,
        }
      );
    }

    // -----------------------------
    // HASH ENTERED OTP
    // -----------------------------
    const submittedOtpHash =
      await hashOtp(otp);

    // -----------------------------
    // STRICT OTP CHECK
    // -----------------------------
    const otpIsCorrect =
      submittedOtpHash ===
      challenge.otp_hash;

    // -----------------------------
    // WRONG OTP
    // -----------------------------
    if (!otpIsCorrect) {
      const nextAttempts =
        attempts + 1;

      const {
        error: updateAttemptError,
      } =
        await supabaseAdmin
          .from(
            "email_otp_challenges"
          )
          .update({
            attempts: nextAttempts,
          })
          .eq(
            "id",
            challenge.id
          );

      if (updateAttemptError) {
        console.error(
          "Could not update attempts:",
          updateAttemptError.message
        );
      }

      return Response.json(
        {
          success: false,
          verified: false,
          error: "Incorrect OTP.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // -----------------------------
    // CORRECT OTP
    // -----------------------------
    const {
      data: verifiedChallenge,
      error: verifyError,
    } =
      await supabaseAdmin
        .from(
          "email_otp_challenges"
        )
        .update({
          verified_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          challenge.id
        )
        .is(
          "verified_at",
          null
        )
        .select("id")
        .maybeSingle();

    if (
      verifyError ||
      !verifiedChallenge
    ) {
      console.error(
        "Verification update error:",
        verifyError?.message
      );

      return Response.json(
        {
          success: false,
          verified: false,
          error:
            "OTP verification could not be completed.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // -----------------------------
    // SUCCESS
    // -----------------------------
    return Response.json(
      {
        success: true,
        verified: true,
        message:
          "Email verified successfully.",
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
        success: false,
        verified: false,
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