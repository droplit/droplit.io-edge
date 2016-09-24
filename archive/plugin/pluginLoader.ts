const NodeVM = require('vm2').NodeVM;
import * as fs from 'fs';

process.on('message', function(data: any) {
    const options = {
        console: 'inherit',
        sandbox: { },
        require: true,
        requireExternal: true
    };
    const vm = new NodeVM(options);
    const code = fs.readFileSync(require.resolve(data.path));
    const mod = vm.run(code);
});