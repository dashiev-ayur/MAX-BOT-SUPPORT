export interface Manager {
    id: number;
    name: string;
}

export interface Question {
    id: string;
    client_user_id: number;
    client_name: string;
    text: string;
    created_at: string;
}

export interface ManagerMessageRow {
    msg_mid: string;
    question_id: string;
    manager_id: number;
}

export interface MaxMessage {
    body: {
        mid?: string;
        text?: string;
    };
    sender: {
        user_id: number;
        first_name?: string;
    };
    link?: {
        type: string;
        message: {
            mid: string;
        };
    };
}

export interface MaxUpdate {
    update_type: string;
    user?: {
        user_id: number;
        first_name?: string;
    };
    message?: MaxMessage;
}

export interface MaxSendResponse {
    message?: {
        body?: {
            mid?: string;
        };
    };
}
