import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Session,
  UseGuards,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { VerifiedUser } from "src/auth/guards/verified-user.guard";
import { UserDocument } from "src/models/user.entity";
import { Request } from "express";
import { UpdateUserDto } from "./dto/update-user.dto";

@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch("me")
  @UseGuards(VerifiedUser)
  async updateProfile(@Body() _body: UpdateUserDto, @Req() request: Request) {
    const { id } = request.user as UserDocument;

    const { username, profile } = _body;

    if (username) {
      const foundUser = await this.userService.findOneByUsername(username);
      if (foundUser) {
        if (foundUser.id === id)
          throw new BadRequestException(
            "New username cannot be your current username",
          );
        throw new BadRequestException("This username has already been taken.");
      }
    }

    const updateOps = {};

    if (profile) {
      if (profile.firstName !== undefined) {
        updateOps["profile.firstName"] = profile.firstName;
      }
      if (profile.lastName !== undefined) {
        updateOps["profile.lastName"] = profile.lastName;
      }
      if (profile.avatar !== undefined) {
        updateOps["profile.avatar"] = profile.avatar;
      }
      if (profile.dateOfBirth !== undefined) {
        updateOps["profile.dateOfBirth"] = profile.dateOfBirth;
      }
      if (profile.address) {
        if (profile.address.city !== undefined) {
          updateOps["profile.address.city"] = profile.address.city;
        }
        if (profile.address.state !== undefined) {
          updateOps["profile.address.state"] = profile.address.state;
        }
        if (profile.address.country !== undefined) {
          updateOps["profile.address.country"] = profile.address.country;
        }
        if (profile.address.zipCode !== undefined) {
          updateOps["profile.address.zipCode"] = profile.address.zipCode;
        }
        if (profile.address.street !== undefined) {
          updateOps["profile.address.street"] = profile.address.street;
        }
      }
    }

    const {
      phone,
      country,
      profile: userProfile,
    } = await this.userService.update(id, {
      $set: { ...(username && { username }), ...updateOps },
    });

    return {
      message: "Update successful",
      user: {
        username,
        phone,
        country,
        ...(userProfile && { profile: userProfile }),
      },
    };
  }

  @Get("me")
  @UseGuards(VerifiedUser)
  async getUserProfile(@Req() request: Request) {
    const {
      username,
      phone,
      country,
      verification: { phoneVerified },
      security: { password },
      profile,
    } = request.user as UserDocument;

    return {
      username,
      phone,
      country,
      accountVerified: phoneVerified,
      passwordSet: password.trim().length > 0,
      ...(profile && { profile }),
    };
  }
}

// session.name = "Threedots";
// // Manually save the session and wait for it to complete
// await new Promise<void>((resolve, reject) => {
//   session.save((err) => {
//     if (err) {
//       // If saving fails, reject the promise.
//       // This will be caught by NestJS's exception handling BEFORE any response is sent.
//       console.error("Session save error:", err);
//       return reject(
//         new InternalServerErrorException("Failed to save session."),
//       );
//     }
//     // If saving succeeds, resolve the promise.
//     resolve();
//   });
// });
