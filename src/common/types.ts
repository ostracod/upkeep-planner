
export interface Response {
    success: boolean;
}

export interface ErrorResponse extends Response {
    success: false;
    message: string;
    shortMessage?: string; // Displayed in the top right corner of the tasks page.
}

export interface CreateAccountRequest {
    username: string;
    authSalt: string;
    keySalt: string;
    authHash: string;
    emailAddress: string;
}

export interface GetAuthSaltRequest {
    username: string;
}

export interface GetAuthSaltResponse extends Response {
    authSalt: string;
}

export interface LoginRequest {
    username: string;
    authHash: string;
}

export interface LoginResponse extends Response {
    keySalt: string;
    keyVersion: number;
}

export interface AccountRequest {
    // If keyVersion or chunksVersion are present, the server will validate
    // these versions against the account stored in the database.
    keyVersion?: number;
    chunksVersion?: number;
}

export interface GetSaltsResponse extends Response {
    authSalt: string;
    keySalt: string;
    keyVersion: number;
    chunksVersion: number;
}

export interface ValidateAuthHashRequest extends AccountRequest {
    authHash: string;
}

export interface ChangePasswordRequest extends AccountRequest {
    oldAuthHash: string;
    newAuthSalt: string;
    newAuthHash: string;
    newKeySalt: string;
    chunks: { [name: string]: string };
}

export interface ChangePasswordResponse extends Response {
    keyVersion: number;
}

export interface GetChunksRequest extends AccountRequest {
    names: string[];
}

export interface GetChunksResponse extends Response {
    chunks: { [name: string]: string };
    chunksVersion: number;
}

export interface SetChunksRequest extends AccountRequest {
    chunks: { [name: string]: string };
}

export interface SetChunksResponse extends Response {
    chunksVersion: number;
}

export interface GetTaskFilterResponse extends Response {
    taskFilter: string;
}

export interface SetTaskFilterRequest extends AccountRequest {
    taskFilter: string;
}


