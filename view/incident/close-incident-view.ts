import { Incident } from "../../models/incident";
import { ILogger, IModify, IRead, IHttp } from "@rocket.chat/apps-engine/definition/accessors";
import { IncidentService } from "../../service/incident-service";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { IUIKitModalViewParam } from "@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder";
import { UserUtility } from "../../utils/users";
import { IncidentUpdate } from "../../models/incident-update";
import { IncidentStatusEnum } from "../../models/enum/incident-status-enum";

class IncidentCloseViewState {
    public incident: Incident;
    public room: IRoom;

    public static create(): IncidentCloseViewState {
        return new IncidentCloseViewState();
    }

    public withIncident(value: Incident): IncidentCloseViewState {
        this.incident = value;
        return this;
    }

    public withRoom(value: IRoom): IncidentCloseViewState {
        this.room = value;
        return this;
    }
}

export class IncidentCloseView {
    private state: IncidentCloseViewState;
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
                blockId: 'vinc_summary_input',
                element: block.newPlainTextInputElement({
                    initialValue: this.state.incident.title, 
                    actionId: 'vinc_summary_input_value'
                }),
                label: block.newPlainTextObject('Inform the incident summary'),
            })
            .addInputBlock({
                blockId: 'vinc_impact_input',
                element: block.newPlainTextInputElement({
                    actionId: 'vinc_impact_input_value'
                }),
                label: block.newPlainTextObject('Inform the incident impact'),
            })
            .addInputBlock({
                blockId: 'vinc_causes_input',
                element: block.newPlainTextInputElement({
                    actionId: 'vinc_causes_input_value'
                }),
                label: block.newPlainTextObject('Inform the incident root causes'),
            })
            .addInputBlock({
                blockId: 'vinc_resolution_input',
                element: block.newPlainTextInputElement({
                    actionId: 'vinc_resolution_input_value'
                }),
                label: block.newPlainTextObject('Inform the incident resolution'),
            })
            .addInputBlock({
                blockId: 'vinc_detection_input',
                element: block.newPlainTextInputElement({
                    actionId: 'vinc_detection_input_value'
                }),
                label: block.newPlainTextObject('Inform the incident detection'),
            })
        return {
            id: 'incident_close_view',
            title: block.newPlainTextObject('Close the incident'),
            submit: block.newButtonElement({
                actionId: "vinc_close",
                text: block.newPlainTextObject('Close'),
            }),
            close: block.newButtonElement({
                actionId: "vinc_dismiss",
                text: block.newPlainTextObject('Dismiss')
            }),
            blocks: block.getBlocks()
        }
    }

    public setState(incident: Incident, room?: IRoom) {
        if (room) {
            this.state = IncidentCloseViewState.create()
                .withIncident(incident)
                .withRoom(room);
        } else {
            this.state = IncidentCloseViewState.create()
                .withIncident(incident)
                .withRoom(this.state.room);
        }
    }

    public onDismiss() : void {}

    public async onSubmitAsync(data: any, modify: IModify, read: IRead, http: IHttp): Promise<Incident> {    
        let update = IncidentUpdate.create()
            .withId(this.state.incident.id)
            .withTime(new Date())
            .withMessage("Incident solved. Affected services are operational.")
            .withStatus(IncidentStatusEnum.Resolved)
            .withServices(this.state.incident.services);
        try {
            const incident = await this.service.createUpdate(this.state.incident.id, update, read, http);
        
            const messageText = `The incident *${this.state.incident.id}* was solved 🚀
    
                *Created at*: ${new Date(this.state.incident.time).toUTCString()}
                *Solved at*: ${new Date().toUTCString()}
                *Description*: ${this.state.incident.title} 
                *Status*: _${this.state.incident.status}_
                *Services**: ${this.state.incident.services.map(service => `_${service.name}_`).join(', ')}
                *Summary*: ${data['vinc_summary_input']['vinc_summary_input_value']}
                *Impact*: ${data['vinc_impact_input']['vinc_impact_input_value']}
                *Causes*: ${data['vinc_causes_input']['vinc_causes_input_value']}
                *Resolution*: ${data['vinc_resolution_input']['vinc_resolution_input_value']}
                *Detection*: ${data['vinc_detection_input']['vinc_detection_input_value']}
                *Timeline*: 
                ${this.state.incident.updates.map(update => ` - ${update.time ? new Date(update.time).toUTCString() : ''}: ${update.message} \n`).join(' ')}
            `
            const message = modify.getCreator().startMessage()
                .setRoom(this.state.room)
                .setSender(await UserUtility.getRocketCatUser(read))
                .setUsernameAlias('Houston Control')
                .setText(messageText);
            await modify.getCreator().finish(message);

            return incident;
        } catch (err) {
            let alert = modify.getCreator().startMessage()
                .setRoom(this.state.room)
                .setUsernameAlias('Houston Control')
                .setGroupable(false)
                .setText('An error occured during the incident update in statuscentral. Please, try again later');
            await modify.getNotifier().notifyRoom(this.state.room, alert.getMessage());
            throw err;
        }
    }
}