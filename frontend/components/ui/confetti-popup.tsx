'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PartyPopper, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface ConfettiPopupProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
    description?: string;
    acknowledgeLabel?: string;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    rotation: number;
    scale: number;
    color: string;
    velocityX: number;
    velocityY: number;
    rotationSpeed: number;
}

const CONFETTI_COLORS = [
    '#862733', // Primary
    '#FFD700', // Gold
    '#22C55E', // Green
    '#3B82F6', // Blue
    '#F97316', // Orange
    '#A855F7', // Purple
    '#EC4899', // Pink
    '#EF4444', // Red
];

function ConfettiCanvas({ isActive }: { isActive: boolean }) {
    const [particles, setParticles] = useState<Particle[]>([]);

    const createParticles = useCallback(() => {
        const newParticles: Particle[] = [];
        for (let i = 0; i < 50; i++) {
            newParticles.push({
                id: i,
                x: Math.random() * 100,
                y: -10 - Math.random() * 20,
                rotation: Math.random() * 360,
                scale: 0.5 + Math.random() * 0.5,
                color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
                velocityX: (Math.random() - 0.5) * 3,
                velocityY: 2 + Math.random() * 3,
                rotationSpeed: (Math.random() - 0.5) * 10,
            });
        }
        setParticles(newParticles);
    }, []);

    useEffect(() => {
        if (isActive) {
            createParticles();
            // Create multiple bursts
            const interval = setInterval(createParticles, 800);
            const timeout = setTimeout(() => clearInterval(interval), 2400);
            return () => {
                clearInterval(interval);
                clearTimeout(timeout);
            };
        } else {
            setParticles([]);
        }
    }, [isActive, createParticles]);

    useEffect(() => {
        if (particles.length === 0) return;

        const animate = () => {
            setParticles((prev) =>
                prev
                    .map((p) => ({
                        ...p,
                        x: p.x + p.velocityX,
                        y: p.y + p.velocityY,
                        rotation: p.rotation + p.rotationSpeed,
                        velocityY: p.velocityY + 0.1, // Gravity
                    }))
                    .filter((p) => p.y < 120) // Remove particles that fall off
            );
        };

        const interval = setInterval(animate, 50);
        return () => clearInterval(interval);
    }, [particles.length]);

    if (!isActive && particles.length === 0) return null;

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute w-3 h-3"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
                        backgroundColor: p.color,
                        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                    }}
                />
            ))}
        </div>
    );
}

export function ConfettiPopup({
    isOpen,
    onClose,
    title = 'All Tests Passed!',
    message,
    description = 'Congratulations on your achievement!',
    acknowledgeLabel = 'Awesome!',
}: ConfettiPopupProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title=""
            description=""
            size="md"
        >
            <div className="relative">
                <ConfettiCanvas isActive={isOpen} />
                
                <div className="space-y-4 relative z-20">
                    {/* Celebration Icon */}
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                                <PartyPopper className="w-10 h-10 text-white" />
                            </div>
                            <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                            <Sparkles className="w-5 h-5 text-yellow-500 absolute -bottom-1 -left-1 animate-pulse" style={{ animationDelay: '0.5s' }} />
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-center text-gray-900">
                        {title}
                    </h2>

                    {/* Message */}
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                        <p className="text-green-800 font-medium">{message}</p>
                        <p className="text-green-600 text-sm mt-1">{description}</p>
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-center pt-2">
                        <Button
                            onClick={onClose}
                            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-2 text-lg font-semibold shadow-md"
                        >
                            {acknowledgeLabel}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
