import { EnumCollection } from "./enum-collection";

export enum IncidentStatusEnum {
    Investigating = 'Investigating',
    Identified = 'Identified',
    Update = 'Update',
    Monitoring = 'Monitoring',
    Resolved = 'Resolved',
    Default = 'Default',
}
    
export namespace IncidentStatusEnum {
    export function getCollection(): EnumCollection<string>[] {
        return Object.keys(IncidentStatusEnum).map((key) => new EnumCollection(key, IncidentStatusEnum[key]));
    }
}
