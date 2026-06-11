import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from './config.js';
import { prisma } from './prisma.js';

const jwtOptions = {
  secretOrKey: config.jwt.secret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
};

const jwtVerify = async (payload, done) => {
  try {
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }

    // Validate Session
    const session = await prisma.session.findUnique({
      where: { userId: payload.sub },
    });

    if (!session || session.id !== payload.sessionId) {
      return done(null, false); // Session revoked, killed, or replaced by another device
    }

    if (session.expiresAt < new Date()) {
      return done(null, false);
    }

    // Validate User
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        deletedAt: true,
        branchId: true,
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return done(null, false);
    }

    // Attach session details to user object for downstream use
    user.sessionId = session.id;
    user.deviceId = session.deviceId;

    done(null, user);
  } catch (error) {
    done(error, false);
  }
};

const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);

const googleOptions = {
  clientID: config.oauth.google.clientId,
  clientSecret: config.oauth.google.clientSecret,
  callbackURL: config.oauth.google.callbackUrl,
};

const googleVerify = async (accessToken, refreshToken, profile, done) => {
  try {
    // Let auth.service handle merging and creation downstream
    return done(null, profile);
  } catch (error) {
    return done(error, false);
  }
};

const googleStrategy = new GoogleStrategy(googleOptions, googleVerify);

export { jwtStrategy, googleStrategy };
