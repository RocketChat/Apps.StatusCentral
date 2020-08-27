
export class EnumCollection<T> {
    public id: string;
    public value: T;

    constructor(id: string, value: T) {
        this.id = id;
        this.value = value;
    }
}