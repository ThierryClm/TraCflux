import { useState, useRef, useEffect, useCallback } from 'react';
import { safeShowOpenFilePicker } from '../utils/filePicker';
import { compressImageDataUrl, dataUrlBytes, formatBytes, ALERT_ABOVE_BYTES } from '../utils/imageCompressor';
import { toast } from '../utils/toast';
import { setMainOverlayOpen } from '../hooks/usePopupWindow';
import { getGroupColorAtTime as computeGroupColorAtTime, isPPLit } from '../utils/groupColorAtTime';
import './IntersectionImage.css';

const IntersectionImage = ({
    groups,
    imageData,
    onImageChange,
    arrows,
    onArrowsChange,
    cycleLength,
    simulationResult,
    // Animation state (lifted to parent)
    isPlaying,
    playbackSpeed = 1,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    // Hover state for diagram highlighting
    hoveredArrowGroupId,
    setHoveredArrowGroupId,
    // Instant survolé sur le diagramme (prime sur le curseur d'animation)
    hoveredDiagramTime = null,
    // Action data for special actions simulation
    actionData = [],
    selectedActions = [],
    // Conflict matrix for escamotage cut zones
    conflictMatrix = [],
    // File System Access API for remembering directory
    lastImageDirectoryRef,
    saveDirectoryHandle,
    // Recent directories
    recentImageDirs = [],
    addRecentDirectory,
    // Floating image callback (handled by parent)
    onShowFloatingImage,
    // Project name
    intersectionName,
    // Image brightness/contrast (persisted with project)
    imageBrightness = 100,
    setImageBrightness,
    imageContrast = 100,
    setImageContrast
}) => {
    const fileInputRef = useRef(null);
    const containerRef = useRef(null);
    const [selectedArrow, setSelectedArrow] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showImageMenu, setShowImageMenu] = useState(false);

    // Même règle que la barre de menus : une liste déroulante ouverte suspend
    // la remontée des fenêtres détachées, qui la masqueraient.
    useEffect(() => {
        setMainOverlayOpen('imageMenu', showImageMenu);
        return () => setMainOverlayOpen('imageMenu', false);
    }, [showImageMenu]);
    const imageMenuRef = useRef(null);

    // Load display options from localStorage
    const [showGroupNumbers, setShowGroupNumbers] = useState(() => {
        const saved = localStorage.getItem('intersection_showGroupNumbers');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [showGroupNames, setShowGroupNames] = useState(() => {
        const saved = localStorage.getItem('intersection_showGroupNames');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [showArrows, setShowArrows] = useState(() => {
        const saved = localStorage.getItem('intersection_showArrows');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [applyToAllSameType, setApplyToAllSameType] = useState(false);

    // Save display options to localStorage when they change
    useEffect(() => {
        localStorage.setItem('intersection_showGroupNumbers', JSON.stringify(showGroupNumbers));
    }, [showGroupNumbers]);

    useEffect(() => {
        localStorage.setItem('intersection_showGroupNames', JSON.stringify(showGroupNames));
    }, [showGroupNames]);

    useEffect(() => {
        localStorage.setItem('intersection_showArrows', JSON.stringify(showArrows));
    }, [showArrows]);

    // Close image menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (imageMenuRef.current && !imageMenuRef.current.contains(e.target)) {
                setShowImageMenu(false);
            }
        };
        if (showImageMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showImageMenu]);

    // Animation refs
    const animationRef = useRef(null);
    const lastTimeRef = useRef(null);

    // Compresse l'image importée (redimensionnement + WebP) avant de l'appliquer,
    // puis alerte si elle reste volumineuse. L'image source n'est pas modifiée.
    const applyImportedImage = useCallback(async (rawDataUrl) => {
        const originalBytes = dataUrlBytes(rawDataUrl);
        const { dataUrl, compressed } = await compressImageDataUrl(rawDataUrl);
        onImageChange(dataUrl);

        const finalBytes = dataUrlBytes(dataUrl);
        if (compressed && originalBytes > 0) {
            const reduction = Math.round((1 - finalBytes / originalBytes) * 100);
            toast.success(`Image chargée et optimisée : ${formatBytes(originalBytes)} → ${formatBytes(finalBytes)} (−${reduction} %)`);
        } else {
            toast.success(`Image chargée (${formatBytes(finalBytes)})`);
        }

        if (finalBytes > ALERT_ABOVE_BYTES) {
            toast.info("Image encore volumineuse (> 1 Mo) après optimisation. Pour alléger le projet, utilisez une image de définition plus modeste.");
        }
    }, [onImageChange]);

    // Handle image upload via File System Access API
    const handleImageUpload = async (e) => {
        // If called from input element (fallback)
        if (e && e.target && e.target.files) {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    applyImportedImage(event.target.result);
                };
                reader.readAsDataURL(file);
            }
            return;
        }

        // Use File System Access API if available
        if (window.showOpenFilePicker) {
            try {
                const options = {
                    types: [{
                        description: 'Images (photos aériennes, plans, schémas)',
                        accept: {
                            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.avif']
                        }
                    }],
                    multiple: false
                };

                // Use last image directory if available
                if (lastImageDirectoryRef?.current) {
                    options.startIn = lastImageDirectoryRef.current;
                }

                const [fileHandle] = await safeShowOpenFilePicker(options);
                const file = await fileHandle.getFile();

                // Save directory handle
                try {
                    const dirHandle = await fileHandle.getParent?.();
                    if (dirHandle && lastImageDirectoryRef && saveDirectoryHandle) {
                        lastImageDirectoryRef.current = dirHandle;
                        await saveDirectoryHandle('lastImageDirectory', dirHandle);
                        // Ajouter aux répertoires récents
                        if (addRecentDirectory) {
                            addRecentDirectory('image', dirHandle.name, dirHandle);
                        }
                    }
                } catch (err) {
                    // getParent not always available
                }

                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        applyImportedImage(event.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Erreur sélection image:', err);
                }
            }
        } else {
            // Fallback to input element
            fileInputRef.current?.click();
        }
    };

    // Capture d'écran (écran / fenêtre / onglet au choix de l'utilisateur) via
    // l'API Screen Capture. On saisit une image fixe de la surface choisie et
    // on la fait passer par le même chemin que le chargement fichier
    // (compression + optimisation + recadrage ultérieur).
    const handleScreenCapture = async () => {
        setShowImageMenu(false);
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            toast.error("La capture d'écran n'est pas supportée par ce navigateur (nécessite un contexte sécurisé : localhost ou HTTPS).");
            return;
        }
        let stream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            await video.play();
            // Laisse une frame se peindre pour disposer des dimensions réelles.
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            const w = video.videoWidth;
            const h = video.videoHeight;
            if (!w || !h) {
                toast.error("Capture impossible : dimensions de l'image nulles.");
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(video, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/png');

            applyImportedImage(dataUrl);
        } catch (err) {
            // AbortError / NotAllowedError = l'utilisateur a annulé le sélecteur.
            if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                console.error('Capture écran échouée:', err);
                toast.error("Échec de la capture d'écran : " + err.message);
            }
        } finally {
            if (stream) stream.getTracks().forEach(t => t.stop());
        }
    };

    // Colle une image depuis le presse-papiers. Cas d'usage principal :
    // l'utilisateur trace une zone avec l'outil de capture Windows
    // (Win+Maj+S), puis colle ici. L'image suit le même traitement que les
    // autres sources (optimisation + recadrage ultérieur).
    const handlePasteImage = async () => {
        setShowImageMenu(false);
        if (!navigator.clipboard || !navigator.clipboard.read) {
            toast.error("Le collage depuis le presse-papiers n'est pas supporté par ce navigateur (nécessite un contexte sécurisé : localhost ou HTTPS).");
            return;
        }
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const imageType = item.types.find(t => t.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const reader = new FileReader();
                    reader.onload = (event) => applyImportedImage(event.target.result);
                    reader.readAsDataURL(blob);
                    return;
                }
            }
            toast.info("Aucune image dans le presse-papiers. Faites d'abord une capture (Windows : Win+Maj+S), puis recommencez.");
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                toast.error("Accès au presse-papiers refusé. Autorisez-le dans le navigateur, puis réessayez.");
            } else {
                console.error('Collage image échoué:', err);
                toast.error("Échec du collage : " + err.message);
            }
        }
    };

    // Handle click on image to place arrow
    const handleImageClick = (e) => {
        if (!imageData || isDragging || !showArrows) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Find a group without an arrow yet
        const groupsWithoutArrows = groups.filter(g =>
            !arrows.some(a => a.groupId === g.id)
        );

        // Une flèche n'a de sens que portée par un mouvement : c'est le courant
        // (TD, TàD, Piéton…) qui décide du symbole tracé. Tant que la colonne
        // « Courant » de la configuration est vide pour le groupe visé, le clic
        // reste sans effet — sinon on posait une flèche « tout droit » par
        // défaut, muette sur le mouvement qu'elle est censée représenter.
        if (groups.length > 0 && groups.every(g => !(g.courant || '').trim())) {
            toast.error("Aucun courant renseigné : complétez la colonne « Courant » de la configuration avant de placer des flèches.");
            return;
        }

        // Le groupe visé est le premier sans flèche QUI A un courant. Se contenter
        // du premier sans flèche bloquait tout le reste : un groupe au courant vide
        // restait indéfiniment le candidat, et plus aucune flèche ne pouvait être
        // posée pour les groupes suivants, même correctement renseignés.
        const nextGroup = groupsWithoutArrows.find(g => (g.courant || '').trim());
        const nomGroupe = (g) => `GF${g.id}${g.name ? ` — ${g.name}` : ''}`;

        if (!nextGroup) {
            if (groupsWithoutArrows.length > 0) {
                toast.info(`${groupsWithoutArrows.map(nomGroupe).join(', ')} : courant non renseigné, flèche non ajoutée.`);
            }
            return;
        }

        // Les groupes sautés au passage sont signalés : sans ça, la flèche
        // atterrirait sur un autre groupe que celui attendu, sans explication.
        const ignores = groupsWithoutArrows.slice(0, groupsWithoutArrows.indexOf(nextGroup));
        if (ignores.length > 0) {
            toast.info(`${ignores.map(nomGroupe).join(', ')} : courant non renseigné, flèche posée pour ${nomGroupe(nextGroup)}.`);
        }

        const courant = nextGroup.courant || '';
        const newArrow = {
            id: Date.now(),
            groupId: nextGroup.id,
            x,
            y,
            rotation: 0, // Rotation in degrees (0 = up)
            ...(courant === 'TàD' || courant === 'TàG' ? { turnLength: 0.5 } : {}),
            ...(courant === 'Piéton' || courant === 'Cycle' ? { length: 2 } : {})
        };
        onArrowsChange([...arrows, newArrow]);
        setSelectedArrow(newArrow.id);
    };

    // Handle arrow drag
    const handleArrowMouseDown = (e, arrowId) => {
        e.stopPropagation();
        setSelectedArrow(arrowId);
        setIsDragging(true);
        setTimeout(() => containerRef.current?.focus(), 0);

        const rect = containerRef.current.getBoundingClientRect();
        const arrowData = arrows.find(a => a.id === arrowId);
        const offsetX = ((e.clientX - rect.left) / rect.width) * 100 - arrowData.x;
        const offsetY = ((e.clientY - rect.top) / rect.height) * 100 - arrowData.y;

        const handleMouseMove = (moveEvent) => {
            const rect = containerRef.current.getBoundingClientRect();
            const x = Math.max(0, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100 - offsetX));
            const y = Math.max(0, Math.min(100, ((moveEvent.clientY - rect.top) / rect.height) * 100 - offsetY));

            onArrowsChange(arrows.map(a =>
                a.id === arrowId ? { ...a, x, y } : a
            ));
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Rotate arrow by 45 degrees
    const rotateArrow = (arrowId) => {
        onArrowsChange(arrows.map(a => {
            if (a.id === arrowId) {
                const newRotation = ((a.rotation || 0) + 45) % 360;
                return { ...a, rotation: newRotation };
            }
            return a;
        }));
    };

    // Helper to get arrows of the same type as the given arrow
    const getArrowsOfSameType = (arrowId) => {
        const arrow = arrows.find(a => a.id === arrowId);
        if (!arrow) return [];
        const arrowCourant = getGroupInfo(arrow.groupId).courant;
        return arrows.filter(a => getGroupInfo(a.groupId).courant === arrowCourant);
    };

    // Set arrow rotation directly
    const setArrowRotation = (arrowId, rotation) => {
        const rotationValue = parseInt(rotation) || 0;
        if (applyToAllSameType) {
            const sameTypeArrows = getArrowsOfSameType(arrowId);
            const sameTypeIds = new Set(sameTypeArrows.map(a => a.id));
            onArrowsChange(arrows.map(a =>
                sameTypeIds.has(a.id) ? { ...a, rotation: rotationValue } : a
            ));
        } else {
            onArrowsChange(arrows.map(a =>
                a.id === arrowId ? { ...a, rotation: rotationValue } : a
            ));
        }
    };

    // Set arrow scale (zoom)
    const setArrowScale = (arrowId, scale) => {
        const scaleValue = parseFloat(scale) || 1;
        if (applyToAllSameType) {
            const sameTypeArrows = getArrowsOfSameType(arrowId);
            const sameTypeIds = new Set(sameTypeArrows.map(a => a.id));
            onArrowsChange(arrows.map(a =>
                sameTypeIds.has(a.id) ? { ...a, scale: scaleValue } : a
            ));
        } else {
            onArrowsChange(arrows.map(a =>
                a.id === arrowId ? { ...a, scale: scaleValue } : a
            ));
        }
    };

    // Change arrow's associated group
    const changeArrowGroup = (arrowId, newGroupId) => {
        onArrowsChange(arrows.map(a =>
            a.id === arrowId ? { ...a, groupId: newGroupId } : a
        ));
    };

    // Delete arrow
    const deleteArrow = (arrowId) => {
        onArrowsChange(arrows.filter(a => a.id !== arrowId));
        if (selectedArrow === arrowId) {
            setSelectedArrow(null);
        }
    };

    // Arrow keyboard navigation - refs pour données à jour dans le handler
    const arrowsRef = useRef(arrows);
    const selectedArrowRef = useRef(selectedArrow);
    const onArrowsChangeRef = useRef(onArrowsChange);
    arrowsRef.current = arrows;
    selectedArrowRef.current = selectedArrow;
    onArrowsChangeRef.current = onArrowsChange;

    const handleContainerKeyDown = useCallback((e) => {
        if (!selectedArrowRef.current) return;
        const step = 0.2;
        let dx = 0, dy = 0;
        switch (e.key) {
            case 'ArrowLeft':  dx = -step; break;
            case 'ArrowRight': dx = step;  break;
            case 'ArrowUp':    dy = -step; break;
            case 'ArrowDown':  dy = step;  break;
            default: return;
        }
        e.preventDefault();
        e.stopPropagation();
        onArrowsChangeRef.current(arrowsRef.current.map(a =>
            a.id === selectedArrowRef.current
                ? { ...a, x: Math.max(0, Math.min(100, a.x + dx)), y: Math.max(0, Math.min(100, a.y + dy)) }
                : a
        ));
    }, []);

    // Get group info for display
    const getGroupInfo = (groupId) => {
        const group = groups.find(g => g.id === groupId);
        return group ? { name: group.name, courant: group.courant || '' } : { name: '?', courant: '' };
    };

    // Set arrow length (for Piéton/Cycle arrows)
    const setArrowLength = (arrowId, length) => {
        const lengthValue = parseFloat(length) || 1;
        if (applyToAllSameType) {
            const sameTypeArrows = getArrowsOfSameType(arrowId);
            const sameTypeIds = new Set(sameTypeArrows.map(a => a.id));
            onArrowsChange(arrows.map(a =>
                sameTypeIds.has(a.id) ? { ...a, length: lengthValue } : a
            ));
        } else {
            onArrowsChange(arrows.map(a =>
                a.id === arrowId ? { ...a, length: lengthValue } : a
            ));
        }
    };

    // Set arrow turn length (for TàD/TàG arrows - controls the length of the horizontal part)
    const setArrowTurnLength = (arrowId, turnLength) => {
        const turnLengthValue = parseFloat(turnLength) || 1;
        if (applyToAllSameType) {
            const sameTypeArrows = getArrowsOfSameType(arrowId);
            const sameTypeIds = new Set(sameTypeArrows.map(a => a.id));
            onArrowsChange(arrows.map(a =>
                sameTypeIds.has(a.id) ? { ...a, turnLength: turnLengthValue } : a
            ));
        } else {
            onArrowsChange(arrows.map(a =>
                a.id === arrowId ? { ...a, turnLength: turnLengthValue } : a
            ));
        }
    };

    // Render arrow SVG based on courant type
    const renderArrowSVG = (courant, color, arrowLength = 1, turnLength = 1, ppAllume = false) => {
        const strokeWidth = 3;
        const thinStrokeWidth = 2; // Thinner stroke for Piéton/Cycle
        const size = 32;
        // Calculate vertical part length reduction for turn arrows (1 = full, 0.5 = half)
        const verticalReduction = 12 * (1 - turnLength); // Reduce from bottom

        switch (courant) {
            case 'TD': // Tout droit
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TàD': // Tourne à droite
                // Reduce horizontal part: full = 26, min = 14 (just after the curve)
                const tadEndX = 14 + (12 * turnLength); // 14 to 26
                const tadArrowX = tadEndX;
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <path d={`M8,24 L8,12 Q8,8 12,8 L${tadEndX},8`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={`${tadArrowX - 6},2 ${tadArrowX},8 ${tadArrowX - 6},14`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TàG': // Tourne à gauche
                // Reduce horizontal part: full = 6, max = 18 (just after the curve)
                const tagEndX = 18 - (12 * turnLength); // 18 to 6
                const tagArrowX = tagEndX;
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <path d={`M24,24 L24,12 Q24,8 20,8 L${tagEndX},8`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={`${tagArrowX + 6},2 ${tagArrowX},8 ${tagArrowX + 6},14`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'TD_TàD':
            case 'TDTàD': // Legacy support
            case 'TD-TàD': { // Tout droit + Tourne à droite
                // Longueur : rallonge la hampe vers le bas, inchangée à 1.
                // Retour : portée de la branche tournante.
                const bottom = 28 + (arrowLength - 1) * 24;
                const vb = 32 + (arrowLength - 1) * 24;
                // Branche tournante perpendiculaire à la hampe, partant de sa racine.
                // Elle croisait la hampe quand elle en partait à mi-hauteur en
                // oblique ; au pied et à 90°, les deux tracés ne se rencontrent
                // plus. « Retour » (0 à 1) règle sa portée.
                const ANGLE = Math.PI / 2;
                const ct = Math.cos(ANGLE);
                const st = Math.sin(ANGLE);
                const portee = 14 * turnLength;
                const tipX = 12 + portee * st;
                // Attache à MI-HAMPE, donc proportionnelle : à un écart fixe du pied,
            // elle se retrouvait tassée en queue dès que la longueur passait à 2.
            const racineY = (8 + bottom) / 2;
                const tipY = racineY - portee * ct;
                // Barbes de la pointe, tournées du même angle que la branche.
                const barbe = (dx, dy) => `${(tipX + dx * ct - dy * st).toFixed(2)},${(tipY + dx * st + dy * ct).toFixed(2)}`;
                return (
                    <svg width={size} height={size + (arrowLength - 1) * 24} viewBox={`0 0 32 ${vb}`}>
                        {/* Flèche tout droit */}
                        <line x1="12" y1={bottom} x2="12" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="6,14 12,8 18,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        {/* Flèche tourne à droite */}
                        <path d={`M12,${racineY} L${tipX.toFixed(2)},${tipY.toFixed(2)}`} fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={`${barbe(-4, 4)} ${barbe(0, 0)} ${barbe(4, 4)}`} fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            }
            case 'TD_TàG':
            case 'TDTàG': // Legacy support
            case 'TD-TàG': { // Tout droit + Tourne à gauche
                const bottom = 28 + (arrowLength - 1) * 24;
                const vb = 32 + (arrowLength - 1) * 24;
                // Branche tournante perpendiculaire à la hampe, partant de sa racine.
                // Elle croisait la hampe quand elle en partait à mi-hauteur en
                // oblique ; au pied et à 90°, les deux tracés ne se rencontrent
                // plus. « Retour » (0 à 1) règle sa portée.
                const ANGLE = Math.PI / 2;
                const ct = Math.cos(ANGLE);
                const st = -Math.sin(ANGLE);
                const portee = 14 * turnLength;
                const tipX = 20 + portee * st;
                // Attache à MI-HAMPE, donc proportionnelle : à un écart fixe du pied,
            // elle se retrouvait tassée en queue dès que la longueur passait à 2.
            const racineY = (8 + bottom) / 2;
                const tipY = racineY - portee * ct;
                // Barbes de la pointe, tournées du même angle que la branche.
                const barbe = (dx, dy) => `${(tipX + dx * ct - dy * st).toFixed(2)},${(tipY + dx * st + dy * ct).toFixed(2)}`;
                return (
                    <svg width={size} height={size + (arrowLength - 1) * 24} viewBox={`0 0 32 ${vb}`}>
                        {/* Flèche tout droit */}
                        <line x1="20" y1={bottom} x2="20" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="14,14 20,8 26,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        {/* Flèche tourne à gauche */}
                        <path d={`M20,${racineY} L${tipX.toFixed(2)},${tipY.toFixed(2)}`} fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points={`${barbe(-4, 4)} ${barbe(0, 0)} ${barbe(4, 4)}`} fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            }
            case 'TD_G_D': // Tout droit + Tourne à gauche et à droite
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        {/* Flèche tout droit au centre */}
                        <line x1="16" y1="28" x2="16" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="10,14 16,8 22,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        {/* Flèche tourne à gauche */}
                        <path d="M16,20 Q8,20 8,12 L8,10" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="4,14 8,10 12,14" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        {/* Flèche tourne à droite */}
                        <path d="M16,20 Q24,20 24,12 L24,10" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="20,14 24,10 28,14" fill="none" stroke={color} strokeWidth={strokeWidth - 1} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'PP': { // Triangle de priorité piéton
                // Ce n'est pas un mouvement, donc pas une flèche. Contour rouge
                // constant, fond noir ; il ne passe au jaune que pendant la
                // phase jaune du groupe.
                // Le fond ne signale qu'un état : la phase jaune du groupe.
                // Priorité piéton : ce n'est pas un mouvement, donc pas une flèche.
                // Contour rouge constant et fin, fond noir.
                //
                // Le diagramme représente la période de priorité piéton en alternance
                // d'une seconde allumée et d'une seconde éteinte. Le triangle suit la
                // même cadence : jaune les secondes paires de la phase jaune, noir les
                // autres. Sans quoi le symbole serait fixe là où le diagramme clignote.
                // L'allumage est décidé par l'appelant (isPPLit) : il connaît la période
                // du groupe, que le dessin ignore.
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <polygon points="16,12 12,20 20,20" fill={ppAllume ? '#ffff00' : '#000000'} stroke="#e00000" strokeWidth={strokeWidth / 6} strokeLinejoin="round" />
                    </svg>
                );
            }
            case 'Cycle': { // Flèche 1 sens (cyclistes)
                // Un courant cycliste a un SENS : flèche simple, et non la
                // double flèche des traversées piétonnes. Trait fin pour la
                // distinguer d'un courant de véhicules.
                const cycleHeight = size + (arrowLength - 1) * 24;
                const cycleViewBox = 32 + (arrowLength - 1) * 24;
                const cycleTop = 6;
                const cycleBottom = 26 + (arrowLength - 1) * 24;
                return (
                    <svg width={size} height={cycleHeight} viewBox={`0 0 32 ${cycleViewBox}`}>
                        <line x1="16" y1={cycleBottom} x2="16" y2={cycleTop} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                        <polyline points={`11,${cycleTop + 5} 16,${cycleTop} 21,${cycleTop + 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            }
            case 'Piéton': // Flèche 2 sens (piétons)
                // Calculate extended height based on arrowLength (1 = normal, 2 = double, etc.)
                const extendedHeight = size + (arrowLength - 1) * 24; // Add 24px per unit above 1
                const viewBoxHeight = 32 + (arrowLength - 1) * 24;
                const topY = 6;
                const bottomY = 26 + (arrowLength - 1) * 24;
                const centerY = (topY + bottomY) / 2;
                return (
                    <svg width={size} height={extendedHeight} viewBox={`0 0 32 ${viewBoxHeight}`}>
                        {/* Flèche vers le haut */}
                        <line x1="16" y1={centerY} x2="16" y2={topY} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                        <polyline points={`11,${topY + 5} 16,${topY} 21,${topY + 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                        {/* Flèche vers le bas */}
                        <line x1="16" y1={centerY} x2="16" y2={bottomY} stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" />
                        <polyline points={`11,${bottomY - 5} 16,${bottomY} 21,${bottomY - 5}`} fill="none" stroke={color} strokeWidth={thinStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            default: // Flèche simple par défaut
                return (
                    <svg width={size} height={size} viewBox="0 0 32 32">
                        <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
                        <polyline points="8,14 16,6 24,14" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
        }
    };

    // Couleur d'un groupe à un instant donné. La logique vit dans
    // utils/groupColorAtTime.js : elle est partagée avec la fenêtre détachée de
    // l'image, qui en portait une copie réduite — donc divergente.
    const getGroupColorAtTime = useCallback(
        (groupId, time) => computeGroupColorAtTime(groupId, time, {
            groups, simulationResult, cycleLength, actionData, selectedActions, conflictMatrix
        }),
        [groups, simulationResult, cycleLength, actionData, selectedActions, conflictMatrix]
    );

    // Instant affiché, règle commune avec la fenêtre détachée :
    //   1. animation lancée  → le curseur de lecture, et lui seul. Le survol ne
    //      doit pas détourner l'affichage pendant le déroulement.
    //   2. animation à l'arrêt → le point survolé sur le diagramme, à défaut la
    //      position du curseur.
    const displayedTime = isPlaying
        ? (currentTime ?? 0)
        : (hoveredDiagramTime ?? currentTime ?? 0);

    // Animation loop
    useEffect(() => {
        if (isPlaying) {
            lastTimeRef.current = performance.now();

            const animate = (timestamp) => {
                if (lastTimeRef.current === null) {
                    lastTimeRef.current = timestamp;
                }

                const elapsed = timestamp - lastTimeRef.current;

                // Une seconde de cycle par intervalle, l'intervalle étant divisé
                // par la vitesse choisie. On accélère donc le défilement SANS
                // sauter de seconde : le triangle de priorité piéton clignote à
                // la seconde et l'affichage compte en secondes entières —
                // avancer par bonds rendrait les deux faux.
                const intervalle = 1000 / (playbackSpeed || 1);
                if (elapsed >= intervalle) {
                    lastTimeRef.current = timestamp;
                    setCurrentTime(prev => {
                        const effectiveCycleLength = simulationResult?.simulatedCycleLength || cycleLength;
                        const next = prev + 1;
                        return next >= effectiveCycleLength ? 0 : next;
                    });
                }

                animationRef.current = requestAnimationFrame(animate);
            };

            animationRef.current = requestAnimationFrame(animate);
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying, playbackSpeed, cycleLength, simulationResult]);

    // Toggle play/pause
    const togglePlay = () => {
        if (setIsPlaying) setIsPlaying(prev => !prev);
    };

    // Reset animation
    const resetAnimation = () => {
        if (setIsPlaying) setIsPlaying(false);
        if (setCurrentTime) setCurrentTime(0);
    };

    // Handle time slider change
    const handleTimeChange = (newTime) => {
        if (setCurrentTime) setCurrentTime(parseInt(newTime) || 0);
    };

    return (
        <div className="intersection-image-container">
            <div className="intersection-header">
                <h3>Image du carrefour{intersectionName ? ` — ${intersectionName}` : ''}</h3>
                <div className="intersection-controls">
                    {imageData && onShowFloatingImage && (
                        <button
                            className="upload-btn floating-btn"
                            onClick={onShowFloatingImage}
                            title="Ouvrir dans une fenêtre séparée"
                        >
                            Détacher image
                        </button>
                    )}
                    <div className="upload-btn-container" ref={imageMenuRef}>
                        <button
                            className="upload-btn"
                            onClick={() => setShowImageMenu(!showImageMenu)}
                        >
                            {imageData ? 'Changer' : 'Charger'} image
                            <span className="dropdown-arrow">▼</span>
                        </button>
                        {showImageMenu && (
                            <div className="upload-dropdown">
                                <button onClick={() => { setShowImageMenu(false); handleImageUpload(); }}>
                                    Parcourir...
                                </button>
                                <button onClick={handleScreenCapture}>
                                    Capture écran...
                                </button>
                                <button onClick={handlePasteImage} title="Coller une image du presse-papiers (ex. après une capture de zone Windows : Win+Maj+S)">
                                    Coller (presse-papiers)...
                                </button>
                                {recentImageDirs.length > 0 && (
                                    <>
                                        <div className="dropdown-separator" />
                                        <div className="dropdown-header">Répertoires récents</div>
                                        {recentImageDirs.map((dir, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setShowImageMenu(false);
                                                    handleImageUpload();
                                                }}
                                                title={dir.name}
                                            >
                                                {dir.name}
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                />
            </div>

            <div className="intersection-content">
                <div
                    ref={containerRef}
                    className="intersection-image-area"
                    tabIndex="-1"
                    style={{ outline: 'none' }}
                    onClick={handleImageClick}
                    onKeyDown={handleContainerKeyDown}
                >
                {imageData ? (
                    <>
                        <img
                            src={imageData}
                            alt="Carrefour"
                            className="intersection-img"
                            style={{ filter: `brightness(${imageBrightness}%) contrast(${imageContrast}%)` }}
                        />
                        {arrows.map(arrow => {
                            const groupInfo = getGroupInfo(arrow.groupId);
                            const rotation = arrow.rotation || 0;
                            const scale = arrow.scale || 1;
                            const arrowLength = arrow.length || 1;
                            const turnLength = arrow.turnLength || 1;
                            const arrowColor = getGroupColorAtTime(arrow.groupId, displayedTime);
                            const isHovered = hoveredArrowGroupId === arrow.groupId;
                            const isPedestrianOrCycle = groupInfo.courant === 'Piéton' || groupInfo.courant === 'Cycle';
                            return (
                                <div
                                    key={arrow.id}
                                    className={`arrow-marker ${selectedArrow === arrow.id ? 'selected' : ''} ${isPlaying ? 'animating' : ''} ${isHovered ? 'hovered' : ''} ${isPedestrianOrCycle ? 'side-label' : ''}`}
                                    style={{
                                        left: `${arrow.x}%`,
                                        top: `${arrow.y}%`
                                    }}
                                    onMouseDown={(e) => handleArrowMouseDown(e, arrow.id)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedArrow(arrow.id);
                                        setTimeout(() => containerRef.current?.focus(), 0);
                                    }}
                                    onMouseEnter={() => setHoveredArrowGroupId && setHoveredArrowGroupId(arrow.groupId)}
                                    onMouseLeave={() => setHoveredArrowGroupId && setHoveredArrowGroupId(null)}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        rotateArrow(arrow.id);
                                    }}
                                    title={`GF${arrow.groupId} - ${groupInfo.courant || 'Sans courant'} - Double-clic pour tourner`}
                                >
                                    <div
                                        className="arrow-symbol"
                                        style={{
                                            transform: `rotate(${rotation}deg) scale(${scale})`
                                        }}
                                    >
                                        {renderArrowSVG(groupInfo.courant, arrowColor, arrowLength, turnLength, isPPLit(arrow.groupId, displayedTime, { groups, simulationResult, cycleLength }))}
                                    </div>
                                    {showGroupNames && groupInfo.name && (
                                        <span className="arrow-label">
                                            {groupInfo.name}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                        {showGroupNumbers && (() => {
                            const containerW = containerRef.current?.clientWidth || 700;
                            const containerH = containerRef.current?.clientHeight || 500;
                            const groupMap = {};
                            arrows.forEach(arrow => {
                                if (!arrow.groupId) return;
                                const courant = getGroupInfo(arrow.groupId).courant;
                                let px = arrow.x;
                                let py = arrow.y;
                                // Pour TàD/TàG, décaler vers le corps de la flèche (ignorer le retour)
                                if (courant === 'TàD' || courant === 'TàG') {
                                    const scale = arrow.scale || 1;
                                    const svgSize = 96 * scale;
                                    // Corps à x=8 (TàD) ou x=24 (TàG) dans un viewBox 32x32
                                    const dxSvg = courant === 'TàD' ? -8 : 8;
                                    const dySvg = 2; // corps légèrement sous le centre SVG
                                    const dxPx = (dxSvg / 32) * svgSize;
                                    const dyPx = (dySvg / 32) * svgSize;
                                    const rotRad = (arrow.rotation || 0) * Math.PI / 180;
                                    px += (dxPx * Math.cos(rotRad) - dyPx * Math.sin(rotRad)) / containerW * 100;
                                    py += (dxPx * Math.sin(rotRad) + dyPx * Math.cos(rotRad)) / containerH * 100;
                                }
                                if (!groupMap[arrow.groupId]) groupMap[arrow.groupId] = [];
                                groupMap[arrow.groupId].push({ x: px, y: py });
                            });
                            return Object.entries(groupMap).map(([gId, pts]) => {
                                const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
                                const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
                                const isPieton = getGroupInfo(Number(gId)).courant === 'Piéton';
                                return isPieton ? (
                                    <div
                                        key={`gnum-${gId}`}
                                        className="group-number-centroid pieton"
                                        style={{ left: `${cx}%`, top: `${cy}%` }}
                                    >
                                        <svg viewBox="0 0 20 18" width="20" height="18">
                                            <polygon points="10,1 1,17 19,17" fill="rgba(255,255,255,0.7)" stroke="#000" strokeWidth="1"/>
                                            <text x="10" y="15" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000">{gId}</text>
                                        </svg>
                                    </div>
                                ) : (
                                    <div
                                        key={`gnum-${gId}`}
                                        className="group-number-centroid"
                                        style={{ left: `${cx}%`, top: `${cy}%` }}
                                    >
                                        {gId}
                                    </div>
                                );
                            });
                        })()}
                    </>
                ) : (
                    <div className="no-image-placeholder">
                        <p>Cliquez pour charger une image du carrefour</p>
                        <p className="hint">Format: JPEG, PNG</p>
                    </div>
                )}
                </div>

                {/* Right side: Arrow editor */}
                <div className="intersection-sidebar">
                    {selectedArrow ? (
                        <div className="arrow-editor">
                            <h4>Modifier la flèche</h4>
                            {/* Apply to all same type option */}
                            <label className="checkbox-option apply-all-option">
                                <input
                                    type="checkbox"
                                    checked={applyToAllSameType}
                                    onChange={(e) => setApplyToAllSameType(e.target.checked)}
                                />
                                <span>Appliquer à toutes ({(() => {
                                    const selectedArrowData = arrows.find(a => a.id === selectedArrow);
                                    const courant = selectedArrowData ? getGroupInfo(selectedArrowData.groupId).courant : '';
                                    return courant || '?';
                                })()})</span>
                            </label>
                            <div className="editor-row">
                                <label>Groupe:</label>
                                <select
                                    value={arrows.find(a => a.id === selectedArrow)?.groupId || ''}
                                    onChange={(e) => changeArrowGroup(selectedArrow, parseInt(e.target.value))}
                                >
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>
                                            GF{g.id} - {g.name} {g.courant ? `(${g.courant})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="editor-row">
                                <label>Rotation:</label>
                                <div className="rotation-controls">
                                    <button
                                        className="slider-btn minus"
                                        onClick={() => {
                                            const current = arrows.find(a => a.id === selectedArrow)?.rotation || 0;
                                            setArrowRotation(selectedArrow, (current - 1 + 360) % 360);
                                        }}
                                        title="-1°"
                                    >−</button>
                                    <input
                                        type="range"
                                        min="0"
                                        max="359"
                                        value={arrows.find(a => a.id === selectedArrow)?.rotation || 0}
                                        onChange={(e) => setArrowRotation(selectedArrow, e.target.value)}
                                        className="rotation-slider"
                                    />
                                    <button
                                        className="slider-btn plus"
                                        onClick={() => {
                                            const current = arrows.find(a => a.id === selectedArrow)?.rotation || 0;
                                            setArrowRotation(selectedArrow, (current + 1) % 360);
                                        }}
                                        title="+1°"
                                    >+</button>
                                    <input
                                        type="number"
                                        min="0"
                                        max="359"
                                        value={arrows.find(a => a.id === selectedArrow)?.rotation || 0}
                                        onChange={(e) => setArrowRotation(selectedArrow, e.target.value)}
                                        className="rotation-input"
                                    />
                                    <span className="rotation-unit">°</span>
                                </div>
                            </div>
                            <div className="editor-row">
                                <label>Zoom:</label>
                                <div className="scale-controls">
                                    <button
                                        className="slider-btn minus"
                                        onClick={() => {
                                            const current = arrows.find(a => a.id === selectedArrow)?.scale || 1;
                                            setArrowScale(selectedArrow, Math.max(0.5, current - 0.1).toFixed(1));
                                        }}
                                        title="-0.1"
                                    >−</button>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="3"
                                        step="0.1"
                                        value={arrows.find(a => a.id === selectedArrow)?.scale || 1}
                                        onChange={(e) => setArrowScale(selectedArrow, e.target.value)}
                                        className="scale-slider"
                                    />
                                    <button
                                        className="slider-btn plus"
                                        onClick={() => {
                                            const current = arrows.find(a => a.id === selectedArrow)?.scale || 1;
                                            setArrowScale(selectedArrow, Math.min(3, current + 0.1).toFixed(1));
                                        }}
                                        title="+0.1"
                                    >+</button>
                                    <input
                                        type="number"
                                        min="0.5"
                                        max="3"
                                        step="0.1"
                                        value={arrows.find(a => a.id === selectedArrow)?.scale || 1}
                                        onChange={(e) => setArrowScale(selectedArrow, e.target.value)}
                                        className="scale-input"
                                    />
                                    <span className="scale-unit">x</span>
                                </div>
                            </div>
                            {/* Length option - only for Piéton/Cycle arrows */}
                            {(() => {
                                const selectedArrowData = arrows.find(a => a.id === selectedArrow);
                                const selectedGroupInfo = selectedArrowData ? getGroupInfo(selectedArrowData.groupId) : null;
                                // La hampe des mouvements composés se règle aussi en longueur.
                                const AVEC_LONGUEUR = ['Piéton', 'Cycle', 'TD_TàD', 'TD_TàG', 'TDTàD', 'TDTàG', 'TD-TàD', 'TD-TàG'];
                                const isPedOrCycle = selectedGroupInfo && AVEC_LONGUEUR.includes(selectedGroupInfo.courant);
                                return isPedOrCycle ? (
                                    <div className="editor-row">
                                        <label>Longueur:</label>
                                        <div className="length-controls">
                                            <input
                                                type="range"
                                                min="1"
                                                max="4"
                                                step="0.5"
                                                value={selectedArrowData?.length || 1}
                                                onChange={(e) => setArrowLength(selectedArrow, e.target.value)}
                                                className="length-slider"
                                            />
                                            <input
                                                type="number"
                                                min="1"
                                                max="4"
                                                step="0.5"
                                                value={selectedArrowData?.length || 1}
                                                onChange={(e) => setArrowLength(selectedArrow, e.target.value)}
                                                className="length-input"
                                            />
                                            <span className="length-unit">x</span>
                                        </div>
                                    </div>
                                ) : null;
                            })()}
                            {/* Turn length option - only for TàD/TàG arrows */}
                            {(() => {
                                const selectedArrowData = arrows.find(a => a.id === selectedArrow);
                                const selectedGroupInfo = selectedArrowData ? getGroupInfo(selectedArrowData.groupId) : null;
                                // « Retour » : portée de la branche tournante, pour les
                                // mouvements tournants comme pour les composés.
                                const AVEC_RETOUR = ['TàD', 'TàG', 'TD_TàD', 'TD_TàG', 'TDTàD', 'TDTàG', 'TD-TàD', 'TD-TàG'];
                                const isTurnArrow = selectedGroupInfo && AVEC_RETOUR.includes(selectedGroupInfo.courant);
                                return isTurnArrow ? (
                                    <div className="editor-row">
                                        <label>Retour:</label>
                                        <div className="turn-length-controls">
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={selectedArrowData?.turnLength || 1}
                                                onChange={(e) => setArrowTurnLength(selectedArrow, e.target.value)}
                                                className="turn-length-slider"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={selectedArrowData?.turnLength || 1}
                                                onChange={(e) => setArrowTurnLength(selectedArrow, e.target.value)}
                                                className="turn-length-input"
                                            />
                                            <span className="turn-length-unit">x</span>
                                        </div>
                                    </div>
                                ) : null;
                            })()}
                            <button className="delete-arrow-btn" onClick={() => deleteArrow(selectedArrow)}>
                                Supprimer
                            </button>
                        </div>
                    ) : showArrows ? (
                        <div className="no-selection-hint">
                            <p>Cliquez sur l'image pour ajouter une flèche</p>
                            <p>Sélectionnez une flèche pour la modifier</p>
                        </div>
                    ) : null}

                    {/* Display options */}
                    <div className="display-options">
                        <label className="checkbox-option">
                            <input
                                type="checkbox"
                                checked={showGroupNumbers}
                                onChange={(e) => setShowGroupNumbers(e.target.checked)}
                            />
                            <span>Afficher n° des groupes</span>
                        </label>
                        <label className="checkbox-option">
                            <input
                                type="checkbox"
                                checked={showGroupNames}
                                onChange={(e) => setShowGroupNames(e.target.checked)}
                            />
                            <span>Afficher noms des groupes</span>
                        </label>
                        <label className="checkbox-option">
                            <input
                                type="checkbox"
                                checked={showArrows}
                                onChange={(e) => setShowArrows(e.target.checked)}
                            />
                            <span>Ajouter un courant de circulation</span>
                        </label>
                    </div>
                    {imageData && setImageBrightness && (
                        <div className="image-filters">
                            <div className="filter-row">
                                <label>Luminosité:</label>
                                <input
                                    type="range"
                                    min="20"
                                    max="200"
                                    value={imageBrightness}
                                    onChange={(e) => setImageBrightness(Number(e.target.value))}
                                    className="filter-slider"
                                />
                                <span className="filter-value">{imageBrightness}%</span>
                            </div>
                            <div className="filter-row">
                                <label>Contraste:</label>
                                <input
                                    type="range"
                                    min="20"
                                    max="200"
                                    value={imageContrast}
                                    onChange={(e) => setImageContrast(Number(e.target.value))}
                                    className="filter-slider"
                                />
                                <span className="filter-value">{imageContrast}%</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {imageData && (
                <p className="hint">Glissez pour déplacer. Double-clic pour tourner de 45°.</p>
            )}
        </div>
    );
};

export default IntersectionImage;
