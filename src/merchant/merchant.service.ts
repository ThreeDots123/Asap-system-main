import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { UpdateQuery } from "mongoose";
import { Model } from "mongoose";
import { Merchant, MerchantDocument } from "src/models/merchant.entity";

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

@Injectable()
export class MerchantService {
  constructor(
    @InjectModel(Merchant.name)
    private merchantModel: Model<Merchant>,
  ) {}

  /**
   * Creates a new merchant in the database.
   *
   * @param {Partial<Merchant>} data - The merchant data to create.
   *
   * @returns {Promise<Merchant>} A promise that resolves with the newly created Merchant document.
   */
  async createMerchant(data: DeepPartial<Merchant>) {
    const newMerchant = new this.merchantModel(data);
    return newMerchant.save();
  }

  /**
   * Finds a single merchant by their email.
   * @param email - The email to search for.
   * @returns A merchant document or null if not found.
   */
  async findOneByEmail(email: string): Promise<MerchantDocument | null> {
    return this.merchantModel.findOne({
      email,
    });
  }

  /**
   * Finds a merchant by their unique ID.
   * @param id - The merchant's ID.
   * @returns A merchant document or null if not found.
   */
  async findById(id: string): Promise<MerchantDocument | null> {
    return this.merchantModel.findById(id);
  }

  /**
   * Finds a merchant by their unique ID.
   * @param secretKey - The merchant's ID.
   * @returns A merchant document or null if not found.
   */
  async findBySecretKey(secretKey: string): Promise<MerchantDocument | null> {
    return this.merchantModel.findOne({
      secretKey,
    });
  }

  /**
   * Finds a merchabnt by their whatsapp number.
   * @param number - The whatsapp number of the current merchant.
   * @returns A merchant document or null if not found.
   */
  async findMerchanrByWhatsappNo(
    number: string,
  ): Promise<MerchantDocument | null> {
    return this.merchantModel.findOne({
      whatsappNumber: number,
    });
  }

  /**
   * Updates an existing merchant.
   *
   * @param {string} merchantId - The MongoDB ObjectId of the merchant to update.
   * @param {UpdateQuery<Merchant>} updates - The fields to update.
   * @returns {Promise<Merchant>} The updated merchant document.
   * @throws {NotFoundException} If the merchant does not exist.
   */
  async update(
    merchantId: string,
    updates: UpdateQuery<Merchant>,
  ): Promise<Merchant> {
    const updatedUser = await this.merchantModel
      .findByIdAndUpdate(merchantId, updates, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with id ${merchantId} not found`);
    }

    return updatedUser;
  }
}
