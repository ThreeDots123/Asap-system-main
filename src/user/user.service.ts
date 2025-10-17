import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, UpdateQuery } from "mongoose";
import { User, UserDocument } from "src/models/user.entity";

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  /**
   * Creates a new user in the database.
   *
   * @param {Partial<User>} data - The user data to create.
   * Can include any subset of the User schema fields
   * such as `username`, `phone`, `country`, `email`, `profile`, `security`, etc.
   *
   * @returns {Promise<User>} A promise that resolves with the newly created User document.
   */
  async createUser(data: DeepPartial<User>) {
    const newUser = new this.userModel(data);
    return newUser.save();
  }

  /**
   * Finds a single user by their username or phone number.
   * @param username - The username to search for.
   * @param phone - The phone number to search for.
   * @returns A user document or null if not found.
   */
  async findOneByUsernameOrPhone(
    username: string,
    phone: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findOne({
      $or: [{ username }, { phone }],
    });
  }

  /**
   * Finds a user by their unique ID.
   * @param id - The user's ID.
   * @returns A user document or null if not found.
   */
  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id);
  }

  /**
   * Finds a user by their username.
   * @param username The user's username.
   * @returns A user document or null if not found.
   */
  async findOneByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username });
  }

  /**
   * Finds a user by their phone number.
   * @param phone The user's phone number.
   * @returns A user document or null if not found.
   */
  async findOneByPhoneNumber(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone });
  }

  /**
   * Updates an existing user.
   *
   * @param {string} userId - The MongoDB ObjectId of the user to update.
   * @param {UpdateQuery<User>} updates - The fields to update.
   * @returns {Promise<User>} The updated user document.
   * @throws {NotFoundException} If the user does not exist.
   */
  async update(userId: string, updates: UpdateQuery<User>): Promise<User> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, updates, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    return updatedUser;
  }
}
