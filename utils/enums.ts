import { ServiceStatusEnum } from './../enums/serviceStatus';

export class EnumUtilities {
    public static getServiceStatusFromValue(value: string): ServiceStatusEnum {
        let result: ServiceStatusEnum = ServiceStatusEnum.Unknown;

        Object.keys(ServiceStatusEnum).forEach((k) => {
            if (ServiceStatusEnum[k] === value) {
                result = ServiceStatusEnum[k];
            }
        });

        return result;
    }
}
