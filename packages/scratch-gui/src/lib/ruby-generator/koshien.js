/**
 * Define Ruby code generator for Microbit More Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @return {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.koshien_connectGame = function (block) {
        const name = Generator.valueToCode(block, 'NAME', Generator.ORDER_NONE) || Generator.quote_('player1');
        return `koshien.connect_game(name: ${name})\n`;
    };

    Generator.koshien_getMapArea = function (block) {
        const position = Generator.valueToCode(block, 'POSITION', Generator.ORDER_NONE) || Generator.quote_('0:0');
        return `koshien.get_map_area(${position})\n`;
    };

    Generator.koshien_map = function (block) {
        const position = Generator.valueToCode(block, 'POSITION', Generator.ORDER_NONE) || Generator.quote_('0:0');
        return [`koshien.map(${position})`];
    };

    Generator.koshien_moveTo = function (block) {
        const position = Generator.valueToCode(block, 'POSITION', Generator.ORDER_NONE) || Generator.quote_('0:0');
        return `koshien.move_to(${position})\n`;
    };

    Generator.koshien_calcGoalRoute = function (block) {
        const resultListName = Generator.listNameByName(
            Generator.getFieldValue(block, 'RESULT', Generator.ORDER_NONE)
        );
        const result = resultListName ? `list(${Generator.quote_(resultListName)})` : 'nil';

        return `koshien.calc_route(result: ${result})\n`;
    };

    Generator.koshien_calcRoute = function (block) {
        const src = Generator.valueToCode(block, 'SRC', Generator.ORDER_NONE) || Generator.quote_('0:0');
        const dst = Generator.valueToCode(block, 'DST', Generator.ORDER_NONE) || Generator.quote_('0:0');
        const exceptCellsListName = Generator.listNameByName(
            Generator.getFieldValue(block, 'EXCEPT_CELLS', Generator.ORDER_NONE)
        );
        const exceptCells = exceptCellsListName ? `list(${Generator.quote_(exceptCellsListName)})` : 'nil';
        const resultListName = Generator.listNameByName(
            Generator.getFieldValue(block, 'RESULT', Generator.ORDER_NONE)
        );
        const result = resultListName ? `list(${Generator.quote_(resultListName)})` : 'nil';

        return `koshien.calc_route(result: ${result}, src: ${src}, dst: ${dst}, except_cells: ${exceptCells})\n`;
    };

    Generator.koshien_setItem = function (block) {
        const item = Generator.getFieldValue(block, 'ITEM') || null;
        const position = Generator.valueToCode(block, 'POSITION', Generator.ORDER_NONE) || Generator.quote_('0:0');
        return `koshien.set_${item}(${position})\n`;
    };

    Generator.koshien_mapFrom = function (block) {
        const position = Generator.valueToCode(block, 'POSITION', Generator.ORDER_NONE) || Generator.quote_('0:0');
        const mapVariableName = Generator.variableNameByName(
            Generator.getFieldValue(block, 'MAP', Generator.ORDER_NONE)
        );
        const map = mapVariableName ? mapVariableName : 'nil';
        return [`koshien.map_from(${position}, ${map})`];
    };

    Generator.koshien_mapAll = function () {
        return ['koshien.map_all'];
    };

    Generator.koshien_locateObjects = function (block) {
        const position = Generator.valueToCode(block, 'POSITION', Generator.ORDER_NONE) || Generator.quote_('0:0');
        const sqSize = Generator.valueToCode(block, 'SQ_SIZE', Generator.ORDER_NONE) || 5;
        const objects = Generator.valueToCode(block, 'OBJECTS', Generator.ORDER_NONE) || Generator.quote_('ABCD');
        const resultListName = Generator.listNameByName(
            Generator.getFieldValue(block, 'RESULT', Generator.ORDER_NONE)
        );
        const result = resultListName ? `list(${Generator.quote_(resultListName)})` : 'nil';

        // eslint-disable-next-line max-len
        return `koshien.locate_objects(result: ${result}, sq_size: ${sqSize}, cent: ${position}, objects: ${objects})\n`;
    };

    Generator.koshien_targetCoordinate = function (block) {
        const target = Generator.getFieldValue(block, 'TARGET') || 'player';
        const coordinate = Generator.getFieldValue(block, 'COORDINATE') || 'position';
        if (coordinate === 'position') {
            return [`koshien.${target}`];
        }
        return [`koshien.${target}_${coordinate}`];
    };

    Generator.koshien_turnOver = function () {
        return `koshien.turn_over\n`;
    };

    Generator.koshien_position = function (block) {
        const x = Generator.valueToCode(block, 'X', Generator.ORDER_NONE) || 0;
        const y = Generator.valueToCode(block, 'Y', Generator.ORDER_NONE) || 0;
        return [`koshien.position(${x}, ${y})`];
    };

    Generator.koshien_positionOf = function (block) {
        const position = Generator.valueToCode(block, 'POSITION', Generator.ORDER_NONE) || Generator.quote_('0:0');
        const coordinate = Generator.getFieldValue(block, 'COORDINATE') || 'x';
        return [`koshien.position_of_${coordinate}(${position})`];
    };

    Generator.koshien_object = function (block) {
        const object = Generator.quote_(Generator.getFieldValue(block, 'OBJECT') || 'unknown');
        return [`koshien.object(${object})`];
    };

    Generator.koshien_setMessage = function (block) {
        const message = Generator.valueToCode(block, 'MESSAGE', Generator.ORDER_NONE) || Generator.quote_('hello');
        return `koshien.set_message(${message})\n`;
    };

    return Generator;
}
