import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from "class-validator";
import { AvailableWalletChains } from "src/common/types/wallet-custody";

export default function IsAvailableChain(validationOpts: ValidationOptions) {
  return (object: Object, propertyName: string) => {
    registerDecorator({
      name: "isAvailableChain",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOpts,
      validator: {
        validate: (value: AvailableWalletChains) => {
          // console.log(Object.values(AvailableWalletChains));
          return Object.values(AvailableWalletChains).includes(value);
        },
        defaultMessage: (args: ValidationArguments) => {
          return `${args.value} is not part of the available wallet chain.`;
        },
      },
    });
  };
}
