export interface IServiceModel {
    id: number;
    name: string;
    status: string;
    description: string;
    group: string;
    link: string;
    tags: Array<string>;
    enabled: boolean;
    updatedAt: Date;
}
