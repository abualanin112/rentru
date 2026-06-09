import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { config } from './config.js';
import { tokenTypes } from '../shared/Tokens.js';
import { userService } from '../modules/iam/index.js';

const jwtOptions = {
  secretOrKey: config.jwt.secret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
};

const jwtVerify = async (payload, done) => {
  try {
    if (payload.type !== tokenTypes.ACCESS) {
      throw new Error('Invalid token type');
    }
    const user = await userService.findUserById(payload.sub, {
      select: {
        id: true,
        name: true,
        email: true,
        isEmailVerified: true,
      },
    });
    if (!user) {
      return done(null, false);
    }
    done(null, user);
  } catch (error) {
    done(error, false);
  }
};

const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);

export { jwtStrategy };
