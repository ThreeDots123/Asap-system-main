import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from "class-validator";
import countryCodes from "src/common/country-codes";

export default function IsCountryCode(validationOpts: ValidationOptions) {
  return (object: Object, propertyName: string) => {
    registerDecorator({
      name: "isCountryCode",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOpts,
      validator: {
        validate: (value: string) => {
          return countryCodes.includes(value);
        },
        defaultMessage: (args: ValidationArguments) => {
          return `${args.value} is not a valid ISO code.`;
        },
      },
    });
  };
}
