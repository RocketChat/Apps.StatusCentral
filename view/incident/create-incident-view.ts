import { IModify, ILogger, IRead, IHttp } from '@rocket.chat/apps-engine/definition/accessors';
import { IOptionObject } from '@rocket.chat/apps-engine/definition/uikit/blocks';
import { IUIKitModalViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';
import { IncidentService } from '../../service/incident-service';
import { Incident } from '../../models/incident';
import { UserUtility } from '../../utils/users';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';

class IncidentsCreateViewState {
    public room: IRoom;
    public incidentStatus: any[]
    public cloudServices: any[];
    public cloudServicesSelected: any[];
    public cloudServiceStatus: any[];

    constructor(room: IRoom, 
        incidentStatus: any[], 
        cloudServices: any[], 
        cloudServicesSelected: any[], 
        cloudServiceStatus: any[]) {
        this.room = room;
        this.incidentStatus = incidentStatus;
        this.cloudServices = cloudServices;
        this.cloudServicesSelected = cloudServicesSelected;
        this.cloudServiceStatus = cloudServiceStatus;
    }
}

export class IncidentsCreateView {
    private state: IncidentsCreateViewState;
    private logger: ILogger;
    private service: IncidentService;

    constructor(logger: ILogger, service: IncidentService) {
        this.logger = logger;
        this.service = service;
    }

    public async renderAsync(modify: IModify): Promise<IUIKitModalViewParam>  {
        const block = modify.getCreator().getBlockBuilder()
        block
            .addInputBlock({
                blockId: 'vinc_title_input',
                element: block.newPlainTextInputElement({actionId: 'vinc_title_input_value'}),
                label: block.newPlainTextObject('Inform the incident title')
            })
            .addSectionBlock({
                text: block.newPlainTextObject('Inform the incident status')
            })
            .addActionsBlock({
                blockId: 'vinc_status_static',
                elements: [
                    block.newStaticSelectElement({
                        placeholder: block.newPlainTextObject('Select the incident status'),
                        actionId: 'vinc_status_static_select',
                        options: this.state.incidentStatus.map((status) => 
                            <IOptionObject> { text: block.newPlainTextObject(status.name), value: status.id }),
                    }),
                ]
            })
            .addDividerBlock()
            .addSectionBlock({
                text: block.newPlainTextObject('Inform the affected services')
            })
            .addActionsBlock({
                blockId: 'vinc_services_multi',
                elements: [
                    block.newMultiStaticElement({
                        placeholder: block.newPlainTextObject('Select the affected services'),
                        actionId: 'vinc_services_multi_select',
                        options: this.state.cloudServices.map((service) => 
                            <IOptionObject> { text: block.newPlainTextObject(service.name), value: service.id }),
                        initialValue: this.state.cloudServicesSelected,
                    }),
                ]
            })
            .addDividerBlock()

        
        this.state.cloudServicesSelected.forEach((id) => {
            const serviceName = this.state.cloudServices.find((item) => item.id == id).name;
            block
                .addSectionBlock({
                    text: block.newPlainTextObject(`Inform the ${serviceName} status`)
                })
                .addActionsBlock({
                    blockId: `vinc_services_${id}_status_static`,
                    elements: [
                        block.newStaticSelectElement({
                            placeholder: block.newPlainTextObject(`Select the status`),
                            actionId: `vinc_services_${id}_status_static_select`,
                            options: this.state.cloudServiceStatus.map((item) => 
                                <IOptionObject> { text: block.newPlainTextObject(item.name), value: item.id })
                        })
                    ]
                })
        })
        
        return {
            id: 'incident_create_view',
            title: block.newPlainTextObject('Create an incident'),
            submit: block.newButtonElement({
                actionId: "vinc_create",
                text: block.newPlainTextObject('Create'),
            }),
            close: block.newButtonElement({
                actionId: "vinc_dismiss",
                text: block.newPlainTextObject('Dismiss')
            }),
            blocks: block.getBlocks()
        }
    }

    public setState(incidentStatus: any[], 
        cloudServices: any[], 
        cloudServicesSelected: any[], 
        cloudServiceStatus: any[],
        room?: IRoom): void {
        if (room) {
            this.state = new IncidentsCreateViewState(room, incidentStatus, cloudServices, cloudServicesSelected, cloudServiceStatus);
        } else {
            this.state = new IncidentsCreateViewState(this.state.room, incidentStatus, cloudServices, cloudServicesSelected, cloudServiceStatus);
        }
    }

    public onDismiss() : void {}

    public async onSubmitAsync(data: any, modify: IModify, read: IRead, http: IHttp) : Promise<Incident> {
        let incident = Incident.create()
            .withTime(new Date())
            .withTitle(data['vinc_title_input']['vinc_title_input_value'])
            .withStatus(data['vinc_status_static']['vinc_status_static_select'])
            .withServices(data['vinc_services_multi']['vinc_services_multi_select'].map((index) => { 
                let service = this.state.cloudServices[index - 1];
                service.status = data[`vinc_services_${index}_status_static`][`vinc_services_${index}_status_static_select`];
                return service;
            }));
        try {
            incident = await this.service.create(incident, read, http);
        
            const messageText = `We have a new incident _(${incident.id})_: *${incident.status.toLocaleUpperCase()}*
    
                _*${incident.title}*_
                *Services affected**:
                    ${incident.services.map(service => ` _${service.name}_: *${service.status}*`)}
            `
            const message = modify.getCreator().startMessage()
                .setRoom(this.state.room)
                .setSender(await UserUtility.getRocketCatUser(read))
                .setUsernameAlias('Houston')
                .setText(messageText)
    
            await modify.getCreator().finish(message);
            return incident;
        } catch (err) {
            let alert = modify.getCreator().startMessage()
                .setRoom(this.state.room)
                .setUsernameAlias('Houston Control')
                .setGroupable(false)
                .setText('An error occured during the incident creation in statuscentral. Please, try again later');
            await modify.getNotifier().notifyRoom(this.state.room, alert.getMessage());
            throw err;
        }
    }
}