export const objectStyles = {
    name: {
        color: 'rgb(136, 19, 145)',
    },
    value: {
        null: {
            color: 'rgb(128, 128, 128)',
        },
        undefined: {
            color: 'rgb(128, 128, 128)',
        },
        string: {
            color: 'rgb(196, 26, 22)',
        },
        symbol: {
            color: 'rgb(196, 26, 22)',
        },
        number: {
            color: 'rgb(28, 0, 207)',
        },
        boolean: {
            color: 'rgb(28, 0, 207)',
        },
        function: {
            keyword: {
                color: 'rgb(170, 13, 145)',
                fontStyle: 'italic',
            },
            name: {
                fontStyle: 'italic',
            },
        },
    },
};

export const styles = {
    base: {
        fontFamily: 'Menlo, monospace',
        fontSize: '12px',
        lineHeight: '14px',
        cursor: 'default',
    },
    propertyNodesContainer: {
        paddingLeft: '12px',
    },
    unselectable: {
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        KhtmlUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        OUserSelect: 'none',
        userSelect: 'none',
    },
    expandControl: {
        color: '#6e6e6e',
        fontSize: '11px',
        marginRight: '3px',
        whiteSpace: 'pre',
    },
    property: {
        paddingTop: '2px',
    },
};