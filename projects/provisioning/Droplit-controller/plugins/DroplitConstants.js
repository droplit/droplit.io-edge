/**
 * Created by Bryan on 6/18/2014.
 */

exports.ConnectResult = {
    SUCCESS : 0,
    HARDWARE_MISSING : 1,
    OTHER_ERROR : 2
}

exports.PropertyAccess = {
    None : 0,
    Read : 1,
    ReadWrite : 2
}

exports.MethodStatus = {
    OK : 'METHOD_IMPLEMENTED',
    NOT_SUPPORTED : 'METHOD_NOT_SUPPORTED',
    NOT_IMPLEMENTED : 'METHOD_NOT_IMPLEMENTED'
}