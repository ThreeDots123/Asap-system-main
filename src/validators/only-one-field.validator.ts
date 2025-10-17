import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from "class-validator";

export default (
  propertyOne: string,
  propertyTwo: string,
  validationOpts: ValidationOptions,
) =>
  function OnlyOneField() {
    return (object: Object, propertyName: string) => {
      registerDecorator({
        name: "onlyOneField",
        target: object.constructor,
        propertyName,
        options: validationOpts,
        validator: {
          validate: (_: any, args: ValidationArguments) => {
            const obj = args.object as any;
            return (
              (obj[propertyOne] && !obj[propertyTwo]) ||
              (obj[propertyTwo] && !obj[propertyOne])
            );
          },
          defaultMessage: (args: ValidationArguments) => {
            return `All fields cannot exist at once.`;
          },
        },
      });
    };
  };
